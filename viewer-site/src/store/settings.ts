// ──────────────────────────────────────────────────────────
// Settings store — сохраняется в localStorage
//
// Позволяет менять:
//   - maxWidth       (макс. ширина вьювера, ≤1440px, ≤100vw)
//   - textColor      (цвет текста)
//   - bgColor        (фон контента)
//   - pageBgColor    (фон страницы)
//   - linkColor      (цвет ссылок)
//   - commentColor   (цвет комментариев)
//   - quoteColor     (бордер цитат)
// ──────────────────────────────────────────────────────────

import { createSignal, createRoot } from "solid-js";

export interface ViewerSettings {
  maxWidth: number;
  textColor: string;
  bgColor: string;
  pageBgColor: string;
  linkColor: string;
  commentColor: string;
  quoteColor: string;
}

const DEFAULTS: ViewerSettings = {
  maxWidth: 900,
  textColor: "#e2e4ed",
  bgColor: "#343c52",
  pageBgColor: "#1b1f2a",
  linkColor: "#4f46e5",
  commentColor: "#e5c07b",
  quoteColor: "#4f46e5",
};

const STORAGE_KEY = "ranobe_viewer_settings";

function loadSettings(): ViewerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function saveSettings(s: ViewerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ── Глобальное состояние (createRoot чтобы был синглтон) ─

function createSettingsStore() {
  const initial = loadSettings();

  const [maxWidth, setMaxWidth] = createSignal<number>(initial.maxWidth);
  const [textColor, setTextColor] = createSignal<string>(initial.textColor);
  const [bgColor, setBgColor] = createSignal<string>(initial.bgColor);
  const [pageBgColor, setPageBgColor] = createSignal<string>(initial.pageBgColor);
  const [linkColor, setLinkColor] = createSignal<string>(initial.linkColor);
  const [commentColor, setCommentColor] = createSignal<string>(initial.commentColor);
  const [quoteColor, setQuoteColor] = createSignal<string>(initial.quoteColor);

  function persist() {
    saveSettings({
      maxWidth: maxWidth(),
      textColor: textColor(),
      bgColor: bgColor(),
      pageBgColor: pageBgColor(),
      linkColor: linkColor(),
      commentColor: commentColor(),
      quoteColor: quoteColor(),
    });
  }

  // Оборачиваем сеттеры для автосохранения
  const setters = {
    setMaxWidth(v: number) {
      setMaxWidth(Math.max(320, Math.min(1440, v)));
      persist();
    },
    setTextColor(v: string) {
      setTextColor(v);
      persist();
    },
    setBgColor(v: string) {
      setBgColor(v);
      persist();
    },
    setPageBgColor(v: string) {
      setPageBgColor(v);
      persist();
    },
    setLinkColor(v: string) {
      setLinkColor(v);
      persist();
    },
    setCommentColor(v: string) {
      setCommentColor(v);
      persist();
    },
    setQuoteColor(v: string) {
      setQuoteColor(v);
      persist();
    },
    resetAll() {
      setMaxWidth(DEFAULTS.maxWidth);
      setTextColor(DEFAULTS.textColor);
      setBgColor(DEFAULTS.bgColor);
      setPageBgColor(DEFAULTS.pageBgColor);
      setLinkColor(DEFAULTS.linkColor);
      setCommentColor(DEFAULTS.commentColor);
      setQuoteColor(DEFAULTS.quoteColor);
      persist();
    },
  };

  return {
    maxWidth,
    textColor,
    bgColor,
    pageBgColor,
    linkColor,
    commentColor,
    quoteColor,
    ...setters,
  };
}

export const settings = createRoot(createSettingsStore);
