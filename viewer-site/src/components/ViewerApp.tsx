// ──────────────────────────────────────────────────────────
// ViewerApp — главный layout
//
// Применяет CSS-переменные из settings.store на :root,
// управляет состоянием загрузки/ошибки документа.
// Кнопка настроек — справа снизу, прячется при скролле вниз.
// ──────────────────────────────────────────────────────────

import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { settings } from "../store/settings";
import { injectViewerStyles } from "../render";
import { loadDocument } from "../rpc";
import type { ViewerDocument } from "../types";
import { renderDocument, initViewerComments } from "../render";
import { SettingsPanel } from "./SettingsPanel";
import "../viewer.css";

export function ViewerApp(props: { docId?: string }) {
  const [html, setHtml] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  // ── Стили вьювера ──────────────────────────────────

  onMount(() => {
    injectViewerStyles();
  });

  // ── CSS-переменные из настроек ─────────────────────

  function cssVars() {
    const s = settings;
    const linkHover = lighten(s.linkColor(), 0.15);
    const codeBg = darken(s.bgColor(), 0.15);
    const codeBorder = darken(s.bgColor(), 0.25);
    const headerBg = darken(s.pageBgColor(), 0.05);
    const headerBorder = darken(s.pageBgColor(), 0.12);
    const muted = mix(s.textColor(), s.pageBgColor(), 0.5);
    const hr = darken(s.bgColor(), 0.15);
    const quoteBg = alpha(s.textColor(), 0.03);

    return {
      "--vv-text": s.textColor(),
      "--vv-bg": s.bgColor(),
      "--vv-page-bg": s.pageBgColor(),
      "--vv-link": s.linkColor(),
      "--vv-link-hover": linkHover,
      "--vv-comment": s.commentColor(),
      "--vv-quote": s.quoteColor(),
      "--vv-quote-bg": quoteBg,
      "--vv-code-bg": codeBg,
      "--vv-code-border": codeBorder,
      "--vv-header-bg": headerBg,
      "--vv-header-border": headerBorder,
      "--vv-muted": muted,
      "--vv-hr": hr,
    } as Record<string, string>;
  }

  // ── Загрузка документа ─────────────────────────────

  async function loadDoc(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const bigId = BigInt(id);
      const doc = await loadDocument(bigId);
      const rendered = renderDocument(doc as unknown as ViewerDocument);
      setHtml(rendered);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setHtml(null);
    } finally {
      setLoading(false);
    }
  }

  // Автозагрузка при изменении id в URL
  createEffect(() => {
    const id = props.docId;
    if (id) {
      loadDoc(id);
    } else {
      setHtml(null);
      setError(null);
    }
  });

  // ── Активация комментариев после рендера ────────────

  createEffect(() => {
    const h = html();
    if (h) {
      requestAnimationFrame(() => {
        initViewerComments();
      });
    }
  });

  // ── Render ─────────────────────────────────────────

  return (
    <div class="viewer-app" style={cssVars()}>
      {error() && <div class="viewer-error">{error()}</div>}

      <main
        class="viewer-main"
        style={{ "max-width": `${settings.maxWidth()}px` }}
      >
        {loading() && <div class="viewer-loading">Loading…</div>}
        {!loading() && !error() && html() != null && (
          <div innerHTML={html()!} />
        )}
        {!loading() && !error() && html() == null && (
          <div class="viewer-placeholder">
            Open a document via URL, e.g. <code>/123</code>
          </div>
        )}
      </main>

      {/* Кнопка настроек справа снизу — прячется при скролле вниз */}
      <FloatingSettingsButton
        onOpen={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen()}
      />

      {settingsOpen() && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

// ── Floating settings button ───────────────────────────
// Прячется при скролле вниз, появляется при скролле вверх

function FloatingSettingsButton(props: {
  onOpen: () => void;
  settingsOpen: boolean;
}) {
  const [visible, setVisible] = createSignal(true);

  onMount(() => {
    let lastScrollY = window.scrollY;

    function onScroll() {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 20) {
        // Скроллим вниз и ниже 20px — прячем
        setVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Скроллим вверх — показываем
        setVisible(true);
      }

      lastScrollY = currentScrollY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll));
  });

  return (
    <button
      class="floating-settings"
      classList={{
        "floating-settings--hidden": !visible() || props.settingsOpen,
      }}
      onClick={props.onOpen}
      title="Settings"
      aria-label="Settings"
    >
      ⚙
    </button>
  );
}

// ── Цветовые утилиты ─────────────────────────────────

function lighten(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const f = 1 + amount;
  return rgbToHex(
    Math.min(255, Math.round(r * f)),
    Math.min(255, Math.round(g * f)),
    Math.min(255, Math.round(b * f)),
  );
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const f = 1 - amount;
  return rgbToHex(
    Math.max(0, Math.round(r * f)),
    Math.max(0, Math.round(g * f)),
    Math.max(0, Math.round(b * f)),
  );
}

function mix(fg: string, bg: string, ratio: number): string {
  const c1 = parseHex(fg);
  const c2 = parseHex(bg);
  return rgbToHex(
    Math.round(c1.r * ratio + c2.r * (1 - ratio)),
    Math.round(c1.g * ratio + c2.g * (1 - ratio)),
    Math.round(c1.b * ratio + c2.b * (1 - ratio)),
  );
}

function alpha(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
