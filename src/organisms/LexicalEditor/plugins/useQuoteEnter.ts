import { onMount, onCleanup } from "solid-js";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  ElementNode,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_LOW,
  LexicalEditor,
  LexicalNode,
} from "lexical";
import { $isQuoteNode } from "../nodes/QuoteNode";

/**
 * Custom Enter handling inside QuoteNode.
 *
 * Lexical's default `registerRichText` treats QuoteNode as a top-level block.
 * When you press Enter inside a quote, it creates a new paragraph OUTSIDE the
 * quote instead of inside it. This handler overrides that to:
 *
 *   1. Non-empty paragraph + Enter → new paragraph INSIDE the quote
 *   2. Empty paragraph + Enter    → paragraph moves OUTSIDE the quote (exit)
 *
 * This gives the "2 Enters to exit" UX (first Enter creates blank line,
 * second Enter exits the quote).
 */
export function useQuoteEnter(editor: LexicalEditor): void {
  onMount(() => {
    const unreg = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null): boolean => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return false;

        // Walk up from anchor to find QuoteNode
        let node = sel.anchor.getNode();
        let insideQuote = false;
        while (node) {
          if ($isQuoteNode(node)) {
            insideQuote = true;
            break;
          }
          node = node.getParent()!;
        }

        if (!insideQuote) return false;

        event?.preventDefault();

        const anchorNode = sel.anchor.getNode();
        const currentBlock = anchorNode.getTopLevelElementOrThrow();
        const quoteNode = currentBlock.getParentOrThrow();

        // ── Empty paragraph → exit the quote ──
        if (currentBlock.getTextContent().length === 0) {
          currentBlock.remove();
          quoteNode.insertAfter(currentBlock);
          currentBlock.select();

          // Clean up empty quote
          if (quoteNode.getChildren().length === 0) {
            quoteNode.remove();
          }

          return true;
        }

        // ── Non-empty paragraph → insert new paragraph inside the quote ──
        const newPara = $createParagraphNode();
        const offset = sel.anchor.offset;

        // offset semantics differ by node type:
        //   TextNode    → character index within the text
        //   ElementNode → child index within the inline element (CommentNode, LinkNode)
        const anchorIsText = $isTextNode(anchorNode);
        const boundary = anchorIsText
          ? anchorNode.getTextContent().length
          : (anchorNode as ElementNode).getChildren().length;

        if (offset > 0 && offset < boundary) {
          // Split at cursor: move everything after the cursor to newPara
          splitBlockAtOffset(currentBlock, anchorNode, offset, newPara);
        } else if (offset === 0) {
          // Cursor at start → insert new paragraph BEFORE current
          currentBlock.insertBefore(newPara);
        }
        // else offset === boundary → insert AFTER (handled below)

        if (offset === boundary) {
          currentBlock.insertAfter(newPara);
        }

        newPara.select();

        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    onCleanup(unreg);
  });
}

/**
 * Split a block element at the given offset, moving trailing children
 * (including the tail of the anchor node) into `targetBlock`.
 *
 * Handles both TextNode anchors (offset = character index) and
 * inline ElementNode anchors like CommentNode / LinkNode (offset = child index).
 */
function splitBlockAtOffset(
  block: ElementNode,
  anchorNode: LexicalNode,
  offset: number,
  targetBlock: ElementNode,
): void {
  const children = block.getChildren();
  const anchorIdx = children.findIndex((c) => c.__key === anchorNode.__key);
  if (anchorIdx < 0) return;

  if ($isTextNode(anchorNode)) {
    // ── TextNode anchor: offset is a character index ──
    const nodeText = anchorNode.getTextContent();
    anchorNode.setTextContent(nodeText.slice(0, offset));

    const afterText = nodeText.slice(offset);
    if (afterText) {
      targetBlock.append($createTextNode(afterText));
    }
  } else if (anchorNode instanceof ElementNode) {
    // ── Inline element anchor (CommentNode, LinkNode): offset is child index ──
    const inlineChildren = anchorNode.getChildren();
    if (offset > 0 && offset < inlineChildren.length) {
      const toMove = inlineChildren.slice(offset);
      for (const child of toMove) {
        child.remove();
        targetBlock.append(child);
      }
    }
  }

  // Move remaining sibling nodes that come after the anchor
  const afterChildren = children.slice(anchorIdx + 1);
  for (const child of afterChildren) {
    child.remove();
    targetBlock.append(child);
  }
}
