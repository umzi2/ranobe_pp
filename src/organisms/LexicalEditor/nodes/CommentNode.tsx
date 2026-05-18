import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $createTextNode,
  ElementNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";

export type SerializedCommentNode = Spread<
  { type: "comment"; version: 1; commentText: string },
  SerializedElementNode
>;

export class CommentNode extends ElementNode {
  __comment: string;

  static getType(): string {
    return "comment";
  }

  static clone(node: CommentNode): CommentNode {
    return new CommentNode(node.__comment, node.__key);
  }

  constructor(comment: string, key?: NodeKey) {
    super(key);
    this.__comment = comment;
  }

  getComment(): string {
    return this.getLatest().__comment;
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const span = document.createElement("span");
    span.className = "lx-comment";
    span.style.cssText =
      "color:#e5c07b;cursor:pointer;border-bottom:1px dotted #e5c07b;";
    span.title = this.__comment;
    span.setAttribute("data-comment", this.__comment);

    const text = this.__comment;
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let persistentOpen = false;

    // ── Hover: show tooltip-like popover ──
    span.addEventListener("mouseenter", () => {
      if (persistentOpen) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        showCommentPopover(span, text, false);
        hoverTimer = null;
      }, 200);
    });

    span.addEventListener("mouseleave", () => {
      if (persistentOpen) return;
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      hideCommentPopover();
    });

    // ── mousedown (capture): prevent Lexical from stealing the selection ──
    span.addEventListener(
      "mousedown",
      (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
      },
      true,
    );

    // ── Click / tap: show persistent popup ──
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      persistentOpen = true;
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      hideCommentPopover();
      showCommentPopover(span, text, true);

      // Hide on outside click
      const onOutside = (e: MouseEvent) => {
        const popup = document.querySelector(".lx-comment-popup");
        if (popup && !popup.contains(e.target as Node) && e.target !== span) {
          hideCommentPopover();
          persistentOpen = false;
          document.removeEventListener("click", onOutside);
        }
      };
      setTimeout(() => document.addEventListener("click", onOutside), 0);
    });

    return span;
  }

  updateDOM(_prev: CommentNode, dom: HTMLElement): boolean {
    dom.title = this.__comment;
    dom.setAttribute("data-comment", this.__comment);
    return false;
  }

  isShadowRoot(): boolean {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  exportJSON(): SerializedCommentNode {
    return {
      ...super.exportJSON(),
      type: "comment",
      version: 1,
      commentText: this.__comment,
    };
  }

  static importJSON(data: SerializedCommentNode): CommentNode {
    return $createCommentNode(data.commentText);
  }
}

// ── Popover management ──

let activePopover: HTMLElement | null = null;

function showCommentPopover(
  anchor: HTMLElement,
  text: string,
  persistent: boolean,
): void {
  hideCommentPopover();

  const popup = document.createElement("div");
  popup.className = "lx-comment-popup";
  if (!persistent) popup.classList.add("lx-comment-popup--hover");

  // Content
  const textEl = document.createElement("span");
  textEl.className = "lx-comment-popup-text";
  textEl.textContent = text;
  popup.appendChild(textEl);

  // Arrow
  const arrow = document.createElement("div");
  arrow.className = "lx-comment-popup-arrow";
  popup.appendChild(arrow);

  // Close button (persistent only)
  if (persistent) {
    const close = document.createElement("button");
    close.className = "lx-comment-popup-close";
    close.textContent = "✕";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      hideCommentPopover();
    });
    popup.appendChild(close);
  }

  // Append first so we can measure the popup height for smart positioning
  document.body.appendChild(popup);
  activePopover = popup;

  // Smart position — checks available space above / below
  positionPopover(popup, anchor);

  // Fade in
  requestAnimationFrame(() => {
    popup.classList.add("lx-comment-popup--visible");
  });
}

function positionPopover(popup: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 8; // space between popup edge and comment

  // 1. Apply width constraints BEFORE measuring
  const maxPopupWidth = Math.min(280, viewportWidth - 32);
  popup.style.maxWidth = `${maxPopupWidth}px`;
  popup.style.width = "auto";

  // 2. Measure AFTER constraints are applied (forces reflow)
  const popupHeight = popup.offsetHeight;
  const actualWidth = popup.offsetWidth;

  // 3. Center horizontally using the ACTUAL rendered width
  let left = rect.left + rect.width / 2 - actualWidth / 2;
  left = Math.max(16, left);
  left = Math.min(left, viewportWidth - actualWidth - 16);
  popup.style.left = `${left}px`;

  // 4. Vertical — only popupHeight + gap needed (arrow extends into the gap)
  const needed = popupHeight + gap;
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;

  if (spaceAbove >= needed) {
    // ── Above (default) ──
    popup.style.top = `${rect.top - gap}px`;
    popup.style.transform = "translateY(-100%)";
    popup.classList.remove("lx-comment-popup--below");
  } else if (spaceBelow >= needed) {
    // ── Below (flip) ──
    popup.style.top = `${rect.bottom + gap}px`;
    popup.style.transform = "none";
    popup.classList.add("lx-comment-popup--below");
  } else {
    // ── Not enough space either way — prioritise above ──
    popup.style.top = `${rect.top - gap}px`;
    popup.style.transform = "translateY(-100%)";
    popup.classList.remove("lx-comment-popup--below");
  }
}

function hideCommentPopover(): void {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

// ── Helpers ──

export function $createCommentNode(comment: string): CommentNode {
  return new CommentNode(comment);
}

export function $isCommentNode(
  node: LexicalNode | null | undefined,
): node is CommentNode {
  return node instanceof CommentNode;
}

/**
 * Wrap the current selection in a CommentNode.
 * Call inside editor.update().
 *
 * This uses extract() only for text-splitting, then inserts via
 * parent.splice() — bypassing insertNodes() entirely.
 * insertNodes() breaks inside QuoteNode because:
 *   1. INTERNAL_$isBlock(QuoteNode) = false (first child is ParagraphNode, not inline)
 *   2. After removeText() the anchor lands on QuoteNode, not a recognised "block"
 *   3. insertNodes can't find a block ancestor → throws
 */
export function $toggleComment(commentText: string): void {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return;

  const comment = $createCommentNode(commentText);

  // ── collapsed cursor — delegate to insertNodes (works fine) ──
  if (sel.isCollapsed()) {
    const spacer = $createTextNode("\u200B");
    comment.append(spacer);
    sel.insertNodes([comment]);
    comment.selectStart();
    return;
  }

  // ── non‑collapsed — fully manual ──

  // 1. extract() splits text at boundaries; returned nodes stay in tree
  const extracted = sel.extract();
  if (extracted.length === 0) return;

  // 2. rebuild the selected text (formatting is lost, plain text only)
  let fullText = "";
  for (const n of extracted) {
    if ($isTextNode(n)) fullText += n.getTextContent();
  }
  if (!fullText) return;

  // 3. find the parent paragraph and the insertion index
  const parent = extracted[0].getParentOrThrow();
  const startIdx = parent
    .getChildren()
    .findIndex((c) => c.__key === extracted[0].__key);
  if (startIdx === -1) return;

  // 4. create the comment node with the text inside
  const innerText = $createTextNode(fullText);
  comment.append(innerText);

  // 5. replace extracted nodes with the comment (splice removes & inserts)
  parent.splice(startIdx, extracted.length, [comment]);

  // 6. move cursor inside the comment
  comment.selectStart();
}
