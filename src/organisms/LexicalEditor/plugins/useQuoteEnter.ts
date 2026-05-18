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
        const totalLen = currentBlock.getTextContent().length;

        if (offset > 0 && offset < totalLen) {
          // Split text at cursor: move everything after the cursor to newPara
          splitBlockAtOffset(currentBlock, anchorNode, offset, newPara);
        } else if (offset === 0) {
          // Cursor at start → insert new paragraph BEFORE current
          currentBlock.insertBefore(newPara);
        }
        // else offset === totalLen → insert AFTER (handled below)

        if (offset === totalLen) {
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
 * (including the tail of the anchor text node) into `targetBlock`.
 */
function splitBlockAtOffset(
  block: ElementNode,
  anchorNode: LexicalNode,
  offset: number,
  targetBlock: ElementNode,
): void {
  // This is a simplified approach — we use the fact that for most cases
  // the children are just text nodes. We'll move everything after the
  // anchor node, plus the tail of the anchor node itself.

  const anchorText = $isTextNode(anchorNode) ? anchorNode : null;

  if (anchorText) {
    const nodeText = anchorText.getTextContent();
    // Keep text before offset, move text after offset
    anchorText.setTextContent(nodeText.slice(0, offset));

    const afterText = nodeText.slice(offset);
    if (afterText) {
      const afterNode = $createTextNode(afterText);
      targetBlock.append(afterNode);
    }
  }

  // Move remaining sibling nodes that come after the anchor
  const children = block.getChildren();
  const anchorIdx = children.findIndex((c) => c.__key === anchorNode.__key);
  if (anchorIdx >= 0) {
    const afterChildren = children.slice(anchorIdx + 1);
    for (const child of afterChildren) {
      child.remove();
      targetBlock.append(child);
    }
  }
}
