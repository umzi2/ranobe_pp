// ──────────────────────────────────────────────────────────
// ViewerApp — главный layout
//
// Применяет CSS-переменные из settings.store на :root,
// управляет состоянием загрузки/ошибки документа.
// Верхняя панель появляется только при наведении к верхнему краю.
// ──────────────────────────────────────────────────────────

import { useParams } from "@solidjs/router";
import { createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { settings } from "../store/settings";
import { injectViewerStyles } from "../render";
import { loadDocument } from "../rpc";
import type { ViewerDocument } from "../types";
import { renderDocument } from "../render";
import { SettingsPanel } from "./SettingsPanel";
import "../viewer.css";

export function ViewerApp() {
  const params = useParams<{ id?: string }>();

  const [html, setHtml] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [topBarVisible, setTopBarVisible] = createSignal(false);

  // ── Стили вьювера ──────────────────────────────────

  onMount(() => {
    injectViewerStyles();
  });

  // ── Детект мыши у верхнего края ────────────────────

  let nearTimer: ReturnType<typeof setTimeout> | undefined;

  function onMouseMove(e: MouseEvent) {
    // Показываем полоску когда мышь в верхних 40px экрана
    if (e.clientY <= 40) {
      setTopBarVisible(true);
      clearTimeout(nearTimer);
    } else if (topBarVisible()) {
      // Скрываем с небольшой задержкой
      clearTimeout(nearTimer);
      nearTimer = setTimeout(() => setTopBarVisible(false), 600);
    }
  }

  onMount(() => {
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    onCleanup(() => {
      window.removeEventListener("mousemove", onMouseMove);
      clearTimeout(nearTimer);
    });
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
    const id = params.id;
    if (id) {
      loadDoc(id);
    } else {
      setHtml(null);
      setError(null);
    }
  });

  // ── Render ─────────────────────────────────────────

  return (
    <div class="viewer-app" style={cssVars()}>
      {/* Верхняя полоска — показывается при наведении */}
      <div class="top-bar" classList={{ "top-bar--visible": topBarVisible() }}>
        <span class="top-bar__id">
          {params.id ? `#${params.id}` : "No document"}
        </span>
        <button
          class="top-bar__btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          ⚙
        </button>
      </div>

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

      {settingsOpen() && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </div>
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
