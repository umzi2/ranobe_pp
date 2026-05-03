import { onMount, onCleanup, Accessor } from "solid-js";
import { $getNodeByKey, $getRoot, LexicalEditor } from "lexical";
import { createDragHandle } from "~/molecules/BlockDragHandle/BlockDragHandle";

export function useDraggableBlockPlugin(
  editor: LexicalEditor,
  editorElemAccessor: Accessor<HTMLElement | undefined>
) {
  onMount(() => {
    const editorElem = editorElemAccessor();
    if (!editorElem) return;

    const { handle, dragBtn, destroy: destroyHandle } = createDragHandle();

    // ── Drop indicator line ──────────────────────────────────────────────────
    const dropLine = document.createElement("div");
    dropLine.className = "drag-drop-line";
    Object.assign(dropLine.style, {
      position: "fixed",
      display: "none",
      height: "2px",
      pointerEvents: "none",
      zIndex: "9999",
      borderRadius: "2px",
    });
    document.body.appendChild(dropLine);

    // ── State ────────────────────────────────────────────────────────────────
    let hoveredKey: string | null = null;
    let draggingKey: string | null = null;
    let overHandle = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Helpers ─────────────────────────────────────────────────────────────
    const getBlockKeys = (): string[] =>
      editor.getEditorState().read(() => $getRoot().getChildrenKeys());

    function findBlock(clientY: number): { key: string; elem: HTMLElement } | null {
      for (const key of getBlockKeys()) {
        const elem = editor.getElementByKey(key);
        if (!elem) continue;
        const r = elem.getBoundingClientRect();
        if (clientY >= r.top - 6 && clientY <= r.bottom + 6) {
          return { key, elem };
        }
      }
      return null;
    }

    function showHandle(blockElem: HTMLElement, key: string) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      hoveredKey = key;
      const er = editorElem.getBoundingClientRect();
      const br = blockElem.getBoundingClientRect();
      handle.style.top  = `${br.top + br.height / 2 - 12}px`;
      handle.style.left = `${er.left - 30}px`;
      handle.style.display = "flex";
    }

    function scheduleHide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!overHandle) {
          handle.style.display = "none";
          hoveredKey = null;
        }
        hideTimer = null;
      }, 200);
    }

    // ── Mouse events on editor ───────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const block = findBlock(e.clientY);
      if (block) showHandle(block.elem, block.key);
      else scheduleHide();
    };

    const onMouseLeave = () => scheduleHide();

    // ── DragOver / Drop ──────────────────────────────────────────────────────
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!draggingKey) return;

      const block = findBlock(e.clientY);
      if (!block || block.key === draggingKey) {
        dropLine.style.display = "none";
        return;
      }

      const er = editorElem.getBoundingClientRect();
      const br = block.elem.getBoundingClientRect();
      const above = e.clientY < br.top + br.height / 2;

      dropLine.style.top   = `${(above ? br.top : br.bottom) - 1}px`;
      dropLine.style.left  = `${er.left + 6}px`;
      dropLine.style.width = `${er.width - 12}px`;
      dropLine.style.display = "block";
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dropLine.style.display = "none";
      if (!draggingKey) return;

      const block = findBlock(e.clientY);
      if (!block || block.key === draggingKey) return;

      const targetKey = block.key;
      const br  = block.elem.getBoundingClientRect();
      const above = e.clientY < br.top + br.height / 2;
      const dk  = draggingKey;

      editor.update(() => {
        const dragged = $getNodeByKey(dk);
        const target  = $getNodeByKey(targetKey);
        if (!dragged || !target) return;
        dragged.remove();
        if (above) target.insertBefore(dragged);
        else       target.insertAfter(dragged);
      });
    };

    // ── Handle hover guard ───────────────────────────────────────────────────
    handle.addEventListener("mouseenter", () => {
      overHandle = true;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    handle.addEventListener("mouseleave", () => {
      overHandle = false;
      scheduleHide();
    });

    // ── Drag events on grip ──────────────────────────────────────────────────
    dragBtn.addEventListener("dragstart", (e: DragEvent) => {
      if (!hoveredKey) { e.preventDefault(); return; }
      draggingKey = hoveredKey;
      e.dataTransfer!.effectAllowed = "move";
      e.dataTransfer!.setData("text/plain", draggingKey);

      const el = editor.getElementByKey(draggingKey);
      if (el) {
        e.dataTransfer!.setDragImage(el, 20, el.offsetHeight / 2);
        el.style.opacity = "0.3";
      }
      handle.style.display = "none";
    });

    dragBtn.addEventListener("dragend", () => {
      if (draggingKey) {
        const el = editor.getElementByKey(draggingKey);
        if (el) el.style.opacity = "";
      }
      dropLine.style.display = "none";
      draggingKey = null;
    });

    // ── Register ─────────────────────────────────────────────────────────────
    editorElem.addEventListener("mousemove",  onMouseMove);
    editorElem.addEventListener("mouseleave", onMouseLeave);
    editorElem.addEventListener("dragover",   onDragOver);
    editorElem.addEventListener("drop",       onDrop);

    onCleanup(() => {
      editorElem.removeEventListener("mousemove",  onMouseMove);
      editorElem.removeEventListener("mouseleave", onMouseLeave);
      editorElem.removeEventListener("dragover",   onDragOver);
      editorElem.removeEventListener("drop",       onDrop);
      if (hideTimer) clearTimeout(hideTimer);
      destroyHandle();
      if (document.body.contains(dropLine)) document.body.removeChild(dropLine);
    });
  });
}