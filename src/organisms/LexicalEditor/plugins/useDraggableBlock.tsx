import { onMount, onCleanup, Accessor } from "solid-js";
import { $getNodeByKey, $getRoot, LexicalEditor } from "lexical";
import { createDragHandle } from "~/molecules/BlockDragHandle/BlockDragHandle";

const GAP = 40; // px space opened between blocks during drag

export function useDraggableBlockPlugin(
  editor: LexicalEditor,
  editorElemAccessor: Accessor<HTMLElement | undefined>,
) {
  onMount(() => {
    const raw = editorElemAccessor();
    if (!raw) return;
    const editorElem: HTMLElement = raw;

    const {
      handle,
      dragBtn,
      moveTo,
      show: showHandleEl,
      hide: hideHandleEl,
      destroy: destroyHandle,
    } = createDragHandle();

    // ── Ghost following cursor ───────────────────────────────────────────────
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      display: "none",
      pointerEvents: "none",
      zIndex: "9998",
      opacity: "0.55",
      borderRadius: "6px",
      overflow: "hidden",
      maxWidth: "300px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(ghost);

    // ── Insert preview (semi-transparent clone sitting in the gap) ───────────
    const preview = document.createElement("div");
    Object.assign(preview.style, {
      position: "fixed",
      display: "none",
      pointerEvents: "none",
      zIndex: "9997",
      opacity: "0.3",
      borderRadius: "6px",
      overflow: "hidden",
      boxShadow: "0 0 0 2px rgba(79,70,229,0.5)",
    });
    document.body.appendChild(preview);

    // ── State ────────────────────────────────────────────────────────────────
    let hoveredKey: string | null = null;
    let hoveredEl: HTMLElement | null = null;
    let draggingKey: string | null = null;
    let draggingEl: HTMLElement | null = null;
    let gapEl: HTMLElement | null = null;
    let gapAbove: boolean | null = null;
    let overHandle = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getBlockKeys = (): string[] =>
      editor.getEditorState().read(() => $getRoot().getChildrenKeys());

    function findBlock(
      clientY: number,
      skipKey?: string | null,
    ): { key: string; elem: HTMLElement } | null {
      const skip = skipKey ?? draggingKey;
      for (const key of getBlockKeys()) {
        const elem = editor.getElementByKey(key);
        if (!elem || key === skip) continue;
        const r = elem.getBoundingClientRect();
        if (clientY >= r.top - 12 && clientY <= r.bottom + 12)
          return { key, elem };
      }
      return null;
    }

    function reposition(b: HTMLElement) {
      const er = editorElem.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      moveTo(er.left + 6, br.top + br.height / 2 - 12);
    }

    function showHandle(blockElem: HTMLElement, key: string) {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (draggingKey) return;
      hoveredKey = key;
      hoveredEl = blockElem;
      reposition(blockElem);
      showHandleEl();
    }

    function scheduleHide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!overHandle && !draggingKey) {
          hideHandleEl();
          hoveredKey = null;
          hoveredEl = null;
        }
        hideTimer = null;
      }, 200);
    }

    const onMouseMove = (e: MouseEvent) => {
      if (draggingKey) return;
      const block = findBlock(e.clientY);
      if (block) showHandle(block.elem, block.key);
      else scheduleHide();
    };

    const onMouseLeave = () => scheduleHide();

    const onScroll = () => {
      if (hoveredEl && handle.style.display !== "none" && !draggingKey)
        reposition(hoveredEl);
    };

    // ── Gap helpers ──────────────────────────────────────────────────────────
    function clearGap() {
      if (gapEl) {
        gapEl.style.marginTop = "";
        gapEl.style.marginBottom = "";
        gapEl = null;
        gapAbove = null;
      }
      preview.style.display = "none";
    }

    function openGap(el: HTMLElement, above: boolean) {
      if (gapEl === el && gapAbove === above) return;
      clearGap();
      gapEl = el;
      gapAbove = above;
      if (above) el.style.marginTop = `${GAP}px`;
      else el.style.marginBottom = `${GAP}px`;

      // Position preview clone in the gap — aligned with target block
      const er = editorElem.getBoundingClientRect();
      const br = el.getBoundingClientRect();
      preview.style.display = "block";
      preview.style.left = `${br.left}px`;
      preview.style.width = `${br.width}px`;
      preview.style.height = `${draggingEl!.offsetHeight}px`;
      preview.style.top = `${above ? br.top - GAP : br.bottom}px`;
    }

    // ── DragOver / Drop ──────────────────────────────────────────────────────
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!draggingKey || !draggingEl) return;

      const block = findBlock(e.clientY);
      // If hovering the original block — nothing to show
      if (!block || block.key === draggingKey) {
        clearGap();
        return;
      }

      const br = block.elem.getBoundingClientRect();
      const above = e.clientY < br.top + br.height / 2;
      openGap(block.elem, above);

      ghost.style.left = `${e.clientX + 12}px`;
      ghost.style.top = `${e.clientY + 12}px`;
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      clearGap();
      ghost.style.display = "none";
      if (!draggingKey || !draggingEl) return;

      const block = findBlock(e.clientY);
      // Drop on self — no-op
      if (!block || block.key === draggingKey) {
        cleanupDrag();
        return;
      }

      const targetKey = block.key;
      const br = block.elem.getBoundingClientRect();
      const above = e.clientY < br.top + br.height / 2;
      const dk = draggingKey;

      editor.update(() => {
        const dragged = $getNodeByKey(dk);
        const target = $getNodeByKey(targetKey);
        if (!dragged || !target) return;
        dragged.remove();
        if (above) target.insertBefore(dragged);
        else target.insertAfter(dragged);
      });
      cleanupDrag();
    };

    function cleanupDrag() {
      ghost.style.display = "none";
      clearGap();
      if (draggingEl) {
        draggingEl.style.opacity = "";
        draggingEl = null;
      }
      draggingKey = null;
    }

    // ── Handle hover ─────────────────────────────────────────────────────────
    handle.addEventListener("mouseenter", () => {
      overHandle = true;
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    });
    handle.addEventListener("mouseleave", () => {
      overHandle = false;
      scheduleHide();
    });

    // ── Drag start ───────────────────────────────────────────────────────────
    dragBtn.addEventListener("dragstart", (e: DragEvent) => {
      if (!hoveredKey) {
        e.preventDefault();
        return;
      }
      draggingKey = hoveredKey;

      const el = editor.getElementByKey(draggingKey);
      if (!el) return;

      draggingEl = el;
      el.style.opacity = "0.25";

      // Cursor ghost
      ghost.innerHTML = "";
      const clone = el.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, {
        width: `${el.offsetWidth}px`,
        height: `${el.offsetHeight}px`,
        overflow: "hidden",
        opacity: "1",
        margin: "0",
        transform: "none",
      });
      ghost.appendChild(clone);
      ghost.style.display = "block";

      // Insert preview (same clone reused)
      preview.innerHTML = "";
      const pClone = el.cloneNode(true) as HTMLElement;
      Object.assign(pClone.style, {
        width: "100%",
        height: "100%",
        opacity: "1",
        margin: "0",
        transform: "none",
      });
      preview.appendChild(pClone);

      // Suppress default browser icon
      const empty = document.createElement("img");
      empty.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer!.setDragImage(empty, 0, 0);

      const onDrag = (ev: DragEvent) => {
        if (ev.clientX === 0 && ev.clientY === 0) return;
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      };
      document.addEventListener("dragover", onDrag);

      hideHandleEl();

      const onDragEnd = () => {
        document.removeEventListener("dragover", onDrag);
        document.removeEventListener("dragend", onDragEnd);
        cleanupDrag();
        const el2 = draggingKey ? editor.getElementByKey(draggingKey) : null;
        if (el2) el2.style.opacity = "";
        draggingKey = null;
      };
      document.addEventListener("dragend", onDragEnd);
    });

    // ── Register ─────────────────────────────────────────────────────────────
    editorElem.addEventListener("mousemove", onMouseMove);
    editorElem.addEventListener("mouseleave", onMouseLeave);
    editorElem.addEventListener("dragover", onDragOver);
    editorElem.addEventListener("drop", onDrop);
    const scrollParent = editorElem.parentElement;
    scrollParent?.addEventListener("scroll", onScroll);

    onCleanup(() => {
      editorElem.removeEventListener("mousemove", onMouseMove);
      editorElem.removeEventListener("mouseleave", onMouseLeave);
      editorElem.removeEventListener("dragover", onDragOver);
      editorElem.removeEventListener("drop", onDrop);
      scrollParent?.removeEventListener("scroll", onScroll);
      if (hideTimer) clearTimeout(hideTimer);
      clearGap();
      hideHandleEl();
      destroyHandle();
      if (document.body.contains(ghost)) document.body.removeChild(ghost);
      if (document.body.contains(preview)) document.body.removeChild(preview);
    });
  });
}
