/**
 * ──────────────────────────────────────────────────────────
 * Proto → HTML viewer
 *
 * Полностью независимый рендерер.
 * Не импортирует ничего из основного кода проекта.
 * Максимум — копирует стили текстом (viewer.css).
 * Единственная общая точка — public/fonts.
 *
 * Использование:
 *   import { renderDocument } from "viewer/render";
 *   const html = renderDocument(document);
 *   document.getElementById("viewer")!.innerHTML = html;
 * ──────────────────────────────────────────────────────────
 */

import type { ViewerDocument, ViewerNode } from "./types";
import { NodeType, HeadingTag, Alignment } from "./types";

// ──────────────────────────────────────────────────────────
// Text format bitmask (как у Lexical)
// ──────────────────────────────────────────────────────────
const IS_BOLD = 1;
const IS_ITALIC = 1 << 1;
const IS_STRIKETHROUGH = 1 << 2;
const IS_UNDERLINE = 1 << 3;
const IS_CODE = 1 << 4;
const IS_SUBSCRIPT = 1 << 5;
const IS_SUPERSCRIPT = 1 << 6;

// ──────────────────────────────────────────────────────────
// CSS (инлайново, чтобы не было зависимости от загрузчика)
// ──────────────────────────────────────────────────────────

const VIEWER_STYLE_ID = "vv-style";

/** Вставляет <style> со стилями в <head> при первом вызове */
export function injectViewerStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(VIEWER_STYLE_ID)) return;

  // Мы не импортируем CSS-файл, а генерируем стили прямо в коде.
  // viewer.css существует как reference, но рантайм использует эту строку.
  const css = getInlineCSS();
  const style = document.createElement("style");
  style.id = VIEWER_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function getInlineCSS(): string {
  return /* css */ `
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-Light.woff2") format("woff2");
    font-weight: 300; font-style: normal; font-display: swap;
}
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-Regular.woff2") format("woff2");
    font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-Medium.woff2") format("woff2");
    font-weight: 500; font-style: normal; font-display: swap;
}
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-Semibold.woff2") format("woff2");
    font-weight: 600; font-style: normal; font-display: swap;
}
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-Bold.woff2") format("woff2");
    font-weight: 700; font-style: normal; font-display: swap;
}
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-ExtraBold.woff2") format("woff2");
    font-weight: 800; font-style: normal; font-display: swap;
}
@font-face {
    font-family: "Tilda Sans";
    src: url("/fonts/tildasans/TildaSans-Black.woff2") format("woff2");
    font-weight: 900; font-style: normal; font-display: swap;
}

/* ── Root — как редактор ── */
.vv-root {
    font-family: "Tilda Sans", sans-serif;
    font-weight: 400;
    font-size: 1rem;
    line-height: 1.5;
    color: #e2e4ed;
    background: #343c52;
    -webkit-font-smoothing: antialiased;
    padding: 28px 36px 80px 36px;
    border-radius: 12px;
    word-break: break-word;
}
.vv-root *,
.vv-root *::before,
.vv-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Параграфы — как .editor-paragraph ── */
.vv-root p {
    margin: 0;
    padding: 1px 4px;
    line-height: 1.5;
    color: #e2e4ed;
}

/* ── Заголовки — как .lx-h1 … .lx-h3 ── */
.vv-root h1,
.vv-root h2,
.vv-root h3,
.vv-root h4 {
    color: #e2e4ed;
    font-weight: 600;
    margin: 4px 0 0;
    padding: 1px 4px;
}
.vv-root h1 { font-size: 1.6rem; line-height: 1.25; }
.vv-root h2 { font-size: 1.25rem; line-height: 1.3; }
.vv-root h3 { font-size: 1.05rem; line-height: 1.4; }
.vv-root h4 { font-size: 1rem; line-height: 1.4; }

/* ── Форматирование текста ── */
.vv-text-bold { font-weight: 700; }
.vv-text-italic { font-style: italic; }
.vv-text-strikethrough { text-decoration: line-through; color: #6b7280; }
.vv-text-underline { text-decoration: underline; }
/* Если одновременно underline и strikethrough */
.vv-text-underline.vv-text-strikethrough { text-decoration: underline line-through; }
.vv-text-code {
    font-family: "Courier New", Courier, monospace;
    background: #222535;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
    color: #e2e4ed;
}
.vv-text-subscript { vertical-align: sub; font-size: 0.75em; }
.vv-text-superscript { vertical-align: super; font-size: 0.75em; }

/* ── Ссылки ── */
.vv-root a { color: #4f46e5; text-decoration: none; transition: color 100ms ease; }
.vv-root a:hover { color: #4338ca; }

/* ── Изображения ── */
.vv-image-wrapper {
    display: flex;
    margin: 6px 0;
    border-radius: 8px;
    overflow: hidden;
}
.vv-image-wrapper img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
}
.vv-image-align-left { justify-content: flex-start; }
.vv-image-align-center { justify-content: center; }
.vv-image-align-right { justify-content: flex-end; }

/* ── Цитаты — как .lx-quote ── */
.vv-quote {
    margin: 8px 0;
    padding: 4px 12px;
    border-left: 3px solid #4f46e5;
    background: rgba(226, 228, 237, 0.03);
    border-radius: 0 4px 4px 0;
    color: #e2e4ed;
}
.vv-quote > * { margin: 0; }

/* ── Код ── */
.vv-code {
    display: block;
    background: #1b1f2a;
    padding: 16px;
    border-radius: 8px;
    margin: 12px 0;
    font-family: "Courier New", Courier, monospace;
    font-size: 0.9em;
    white-space: pre-wrap;
    overflow-x: auto;
    color: #e2e4ed;
    border: 1px solid #2a2d3e;
}

/* ── Списки ── */
.vv-root ul,
.vv-root ol {
    margin: 8px 0 8px 24px;
    color: #e2e4ed;
}
.vv-root li { margin-bottom: 4px; }

/* ── Горизонтальная черта — как .lx-hr ── */
.vv-hr {
    display: block;
    height: 2px;
    background: #2a2d3e;
    border: none;
    opacity: 0.6;
    margin: 8px 0;
}

/* ── Перенос строки ── */
.vv-line-break { display: block; }

/* ── Выравнивание ── */
.vv-align-left { text-align: left; }
.vv-align-center { text-align: center; }
.vv-align-right { text-align: right; }
.vv-align-justify { text-align: justify; }

/* ── Комментарий ── */
.vv-comment {
    color: #e5c07b;
    cursor: pointer;
    border-bottom: 1px dotted #e5c07b;
}

/* ── Комментарий: поповер ── */
.vv-comment-popup {
    position: fixed;
    z-index: 9999;
    background: #343c52;
    color: #e2e4ed;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    max-width: 280px;
    width: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
    line-height: 1.5;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.15s ease;
}
.vv-comment-popup--visible {
    opacity: 1;
}
.vv-comment-popup-arrow {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid #343c52;
}
.vv-comment-popup--below .vv-comment-popup-arrow {
    top: -6px;
    bottom: auto;
    border-top: none;
    border-bottom: 6px solid #343c52;
}
.vv-comment-popup-text {
    display: block;
    margin-right: 20px;
}
.vv-comment-popup-close {
    position: absolute;
    top: 4px;
    right: 8px;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    line-height: 1;
}
.vv-comment-popup-close:hover {
    color: #e2e4ed;
}
`.trim();
}

// ──────────────────────────────────────────────────────────
// Main render function
// ──────────────────────────────────────────────────────────

/**
 * Рендерит proto Document в HTML-строку.
 *
 * @param doc  – объект Document (из @bufbuild/protobuf или его JSON-представление)
 * @returns    – HTML-строка для вставки в DOM (без <style>, он вставляется один раз)
 */
export function renderDocument(doc: ViewerDocument): string {
  injectViewerStyles();

  if (!doc.root) return '<div class="vv-root"></div>';

  const inner = renderNode(doc.root);
  return `<div class="vv-root">${inner}</div>`;
}

// ──────────────────────────────────────────────────────────
// Node renderers
// ──────────────────────────────────────────────────────────

function renderNode(node: ViewerNode): string {
  const align = alignmentClass(node.attrs?.["format"] ?? "");

  switch (node.type) {
    case NodeType.ROOT:
      return node.children.map(renderNode).join("");

    case NodeType.PARAGRAPH:
      return `<p class="${align}">${renderInlineChildren(node) || "<br />"}</p>`;

    case NodeType.HEADING: {
      const tag = headingTag(node.data);
      return `<${tag} class="${align}">${renderInlineChildren(node)}</${tag}>`;
    }

    case NodeType.TEXT:
      return renderTextNode(node);

    case NodeType.LINE_BREAK:
      return '<br class="vv-line-break" />';

    case NodeType.IMAGE:
      return renderImage(node);

    case NodeType.HORIZONTAL_RULE:
      return '<hr class="vv-hr" />';

    case NodeType.QUOTE:
      return `<blockquote class="vv-quote">${renderInlineChildren(node)}</blockquote>`;

    case NodeType.CODE:
      return `<pre class="vv-code">${escapeHtml(collectText(node))}</pre>`;

    case NodeType.LIST:
      return renderList(node);

    case NodeType.LIST_ITEM:
      return `<li>${renderInlineChildren(node) || "<br />"}</li>`;

    case NodeType.LINK:
      return renderLink(node);

    case NodeType.COMMENT:
      return renderComment(node);

    default:
      return node.children.map(renderNode).join("");
  }
}

// ──────────────────────────────────────────────────────────
// Text rendering (inline formatting)
// ──────────────────────────────────────────────────────────

function renderTextNode(node: ViewerNode): string {
  const data = node.data.case === "text" ? node.data.value : null;
  if (!data) return "";

  const fmt = data.format;
  let text = escapeHtml(data.text);

  // Применяем форматирование через обёртки
  const wrappers: Array<{ tag: string; cls: string }> = [];

  if (fmt & IS_BOLD) wrappers.push({ tag: "strong", cls: "vv-text-bold" });
  if (fmt & IS_ITALIC) wrappers.push({ tag: "em", cls: "vv-text-italic" });
  if (fmt & IS_STRIKETHROUGH)
    wrappers.push({ tag: "s", cls: "vv-text-strikethrough" });
  if (fmt & IS_UNDERLINE) wrappers.push({ tag: "u", cls: "vv-text-underline" });
  if (fmt & IS_CODE) wrappers.push({ tag: "code", cls: "vv-text-code" });
  if (fmt & IS_SUBSCRIPT)
    wrappers.push({ tag: "sub", cls: "vv-text-subscript" });
  if (fmt & IS_SUPERSCRIPT)
    wrappers.push({ tag: "sup", cls: "vv-text-superscript" });

  for (const w of wrappers) {
    text = `<${w.tag} class="${w.cls}">${text}</${w.tag}>`;
  }

  // Инлайн-стиль из Lexical (например, цвет текста)
  if (data.style) {
    text = `<span style="${escapeAttr(data.style)}">${text}</span>`;
  }

  return text;
}

function renderInlineChildren(node: ViewerNode): string {
  return node.children.map(renderNode).join("");
}

// ──────────────────────────────────────────────────────────
// Specialized renderers
// ──────────────────────────────────────────────────────────

function renderImage(node: ViewerNode): string {
  const data = node.data.case === "image" ? node.data.value : null;
  if (!data) return "";

  const src = escapeAttr(data.src);
  const alt = escapeAttr(data.alt);
  let alignClass = "vv-image-align-left";

  switch (data.alignment) {
    case Alignment.CENTER:
      alignClass = "vv-image-align-center";
      break;
    case Alignment.RIGHT:
      alignClass = "vv-image-align-right";
      break;
  }

  let style = "";
  if (data.width > 0 && data.widthType === "px") {
    style = ` style="width:${data.width}px"`;
  } else if (data.width > 0 && data.widthType === "percent") {
    style = ` style="width:${data.width}%"`;
  }

  return `<figure class="vv-image-wrapper ${alignClass}"><img src="${src}" alt="${alt}"${style} /></figure>`;
}

function renderList(node: ViewerNode): string {
  const data = node.data.case === "list" ? node.data.value : null;
  const tag = data?.ordered ? "ol" : "ul";

  if (data?.ordered && data.start > 1) {
    return `<ol start="${data.start}">${node.children.map(renderNode).join("")}</ol>`;
  }

  return `<${tag}>${node.children.map(renderNode).join("")}</${tag}>`;
}

function renderComment(node: ViewerNode): string {
  const data = node.data.case === "comment" ? node.data.value : null;
  const text = data ? escapeAttr(data.commentText) : "";
  const inner = renderInlineChildren(node);
  return `<span class="vv-comment" data-comment-text="${text}">${inner}</span>`;
}

function renderLink(node: ViewerNode): string {
  const data = node.data.case === "link" ? node.data.value : null;
  if (!data) return renderInlineChildren(node);

  const url = escapeAttr(data.url);
  const title = data.title ? ` title="${escapeAttr(data.title)}"` : "";
  const target = data.target ? ` target="${escapeAttr(data.target)}"` : "";
  const rel = data.rel ? ` rel="${escapeAttr(data.rel)}"` : "";

  return `<a href="${url}"${title}${target}${rel}>${renderInlineChildren(node)}</a>`;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function headingTag(data: ViewerNode["data"]): string {
  if (data.case === "heading" && data.value) {
    switch (data.value.tag) {
      case HeadingTag.H1:
        return "h1";
      case HeadingTag.H2:
        return "h2";
      case HeadingTag.H3:
        return "h3";
      case HeadingTag.H4:
        return "h4";
      case HeadingTag.H5:
        return "h5";
      case HeadingTag.H6:
        return "h6";
    }
  }
  return "h1";
}

function alignmentClass(format: string): string {
  switch (format) {
    case "center":
      return "vv-align-center";
    case "right":
      return "vv-align-right";
    case "justify":
      return "vv-align-justify";
    default:
      return "vv-align-left";
  }
}

/** Собирает весь текст из поддерева (для code и т.д.) */
function collectText(node: ViewerNode): string {
  if (
    node.type === NodeType.TEXT &&
    node.data.case === "text" &&
    node.data.value
  ) {
    return node.data.value.text;
  }
  return node.children.map(collectText).join("");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ──────────────────────────────────────────────────────────
// Comment interactivity (click to show popover)
// ──────────────────────────────────────────────────────────

/**
 * Активирует клик/тап по комментариям во вьювере.
 * Вызвать один раз после того, как HTML вставлен в DOM.
 *
 * Пример:
 *   const html = renderDocument(doc);
 *   document.getElementById("viewer")!.innerHTML = html;
 *   initViewerComments();
 */
export function initViewerComments(): void {
  if (typeof document === "undefined") return;

  let activePopup: HTMLElement | null = null;
  let outsideHandler: ((e: Event) => void) | null = null;

  function hidePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    if (outsideHandler) {
      document.removeEventListener("click", outsideHandler);
      document.removeEventListener("touchstart", outsideHandler);
      outsideHandler = null;
    }
  }

  document.querySelectorAll<HTMLElement>(".vv-comment").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Hide any previously open popup
      hidePopup();

      const text = el.getAttribute("data-comment-text") || "(no text)";

      // Create popup
      const popup = document.createElement("div");
      popup.className = "vv-comment-popup";

      const textEl = document.createElement("span");
      textEl.className = "vv-comment-popup-text";
      textEl.textContent = text;
      popup.appendChild(textEl);

      const arrow = document.createElement("div");
      arrow.className = "vv-comment-popup-arrow";
      popup.appendChild(arrow);

      const close = document.createElement("button");
      close.className = "vv-comment-popup-close";
      close.textContent = "\u2715";
      close.addEventListener("click", (ce) => {
        ce.stopPropagation();
        hidePopup();
      });
      popup.appendChild(close);

      document.body.appendChild(popup);
      activePopup = popup;

      // Smart position
      const rect = el.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const gap = 8;

      const maxW = Math.min(280, viewportW - 32);
      popup.style.maxWidth = `${maxW}px`;

      const popupH = popup.offsetHeight;
      const popupW = popup.offsetWidth;

      // Horizontal: center, clamped to viewport
      let left = rect.left + rect.width / 2 - popupW / 2;
      left = Math.max(8, Math.min(left, viewportW - popupW - 8));
      popup.style.left = `${left}px`;

      // Vertical: prefer above, flip to below if not enough space
      const spaceAbove = rect.top - gap;
      const spaceBelow = viewportH - rect.bottom - gap;
      const needed = popupH + gap;

      if (spaceAbove >= needed) {
        popup.style.top = `${rect.top - gap}px`;
        popup.style.transform = "translateY(-100%)";
        popup.classList.remove("vv-comment-popup--below");
      } else if (spaceBelow >= needed) {
        popup.style.top = `${rect.bottom + gap}px`;
        popup.style.transform = "none";
        popup.classList.add("vv-comment-popup--below");
      } else {
        // Not enough space either way — above anyway
        popup.style.top = `${rect.top - gap}px`;
        popup.style.transform = "translateY(-100%)";
        popup.classList.remove("vv-comment-popup--below");
      }

      // Fade in
      requestAnimationFrame(() => {
        popup.classList.add("vv-comment-popup--visible");
      });

      // Click outside handler
      const onOutside = (oe: Event) => {
        const target = oe.target as Node;
        if (target === el || target === popup || popup.contains(target)) return;
        hidePopup();
      };
      outsideHandler = onOutside;
      setTimeout(() => {
        document.addEventListener("click", onOutside);
        document.addEventListener("touchstart", onOutside);
      }, 0);
    });

    // Also handle touchstart for mobile (faster response)
    el.addEventListener(
      "touchstart",
      (e) => {
        // Let click handler do the work, but prevent text selection
        e.preventDefault();
      },
      { passive: false },
    );
  });
}
