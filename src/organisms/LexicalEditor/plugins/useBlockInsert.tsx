import { onMount, onCleanup, Accessor } from "solid-js";
import { $createParagraphNode, $getNodeByKey, $getRoot, LexicalEditor } from "lexical";
import { createInsertLine, InsertPosition } from "~/molecules/BlockInsertLine/BlockInsertLine";

export function useBlockInsertPlugin(
  editor: LexicalEditor,
  editorElemAccessor: Accessor<HTMLElement | undefined>
) {
  onMount(() => {
    const editorElem = editorElemAccessor();
    if (!editorElem) return;

    // ── State ────────────────────────────────────────────────────────────────
    let pendingKey: string | null = null;
    let pendingPos: InsertPosition = "after";
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let overLine = false;

    // ── Insert line molecule ─────────────────────────────────────────────────
    const { line, setVisible, destroy } = createInsertLine((pos) => {
      if (!pendingKey) return;
      const key = pendingKey;
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (!node) return;
        const para = $createParagraphNode();
        if (pos === "before") node.insertBefore(para);
        else                  node.insertAfter(para);
        para.select();
      });
      setVisible(false, 0, 0, 0);
    });

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getBlockKeys = (): string[] =>
      editor.getEditorState().read(() => $getRoot().getChildrenKeys());

    function findBlock(clientY: number): { key: string; elem: HTMLElement } | null {
      for (const key of getBlockKeys()) {
        const elem = editor.getElementByKey(key);
        if (!elem) continue;
        const r = elem.getBoundingClientRect();
        if (clientY >= r.top - 6 && clientY <= r.bottom + 6)
          return { key, elem };
      }
      return null;
    }

    // The insert line is shown at the top OR bottom edge of the hovered block,
    // depending on where the cursor is (top third → insert before, else → insert after)
    function showLine(block: { key: string; elem: HTMLElement }, clientY: number) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

      const er = editorElem.getBoundingClientRect();
      const br = block.elem.getBoundingClientRect();
      const threshold = br.top + br.height * 0.35;
      const pos: InsertPosition = clientY < threshold ? "before" : "after";

      pendingKey = block.key;
      pendingPos = pos;
      line.dataset.insertPosition = pos;

      const lineY = pos === "before" ? br.top : br.bottom;
      setVisible(true, er.left + 8, lineY, er.width - 16);
    }

    function schedulehide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!overLine) {
          setVisible(false, 0, 0, 0);
          pendingKey = null;
        }
        hideTimer = null;
      }, 250);
    }

    // ── Editor events ────────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const block = findBlock(e.clientY);
      if (block) showLine(block, e.clientY);
      else schedulehide();
    };

    const onMouseLeave = () => schedulehide();

    // ── Line hover guard (keep line visible while hovering it) ────────────────
    line.addEventListener("mouseenter", () => {
      overLine = true;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    line.addEventListener("mouseleave", () => {
      overLine = false;
      schedulehide();
    });

    // ── Register ─────────────────────────────────────────────────────────────
    editorElem.addEventListener("mousemove",  onMouseMove);
    editorElem.addEventListener("mouseleave", onMouseLeave);

    onCleanup(() => {
      editorElem.removeEventListener("mousemove",  onMouseMove);
      editorElem.removeEventListener("mouseleave", onMouseLeave);
      if (hideTimer) clearTimeout(hideTimer);
      destroy();
    });
  });
}