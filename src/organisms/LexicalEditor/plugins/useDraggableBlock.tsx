import { onMount, onCleanup, Accessor } from "solid-js";
import { $getNodeByKey, $getRoot, LexicalEditor } from "lexical";
import { createDragHandle } from "~/molecules/BlockDragHandle/BlockDragHandle";

const GAP = 40; // px space opened between blocks during drag
const MIN_DRAG_DISTANCE = 10; // px — minimum movement to activate drag visuals

/** true if the device supports touch events */
function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

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

    // ── Ghost following cursor / finger ──────────────────────────────────────
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

    // Drag method (native DnD vs. touch polyfill)
    let usingTouch = false;

    // Drag threshold tracking
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;

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

    // ── Client‑Y helper (works for both mouse and touch) ─────────────────────
    function clientY(e: MouseEvent | TouchEvent): number {
      if ("touches" in e)
        return e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
      return (e as MouseEvent).clientY;
    }
    function clientX(e: MouseEvent | TouchEvent): number {
      if ("touches" in e)
        return e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
      return (e as MouseEvent).clientX;
    }

    // ── Mouse handlers (desktop) ─────────────────────────────────────────────
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

    // ── Touch handlers (mobile / tablet) ─────────────────────────────────────
    function onTouchStart(e: TouchEvent) {
      if (draggingKey) return;
      // Show handle at the touched block
      const touch = e.touches[0];
      if (!touch) return;
      const block = findBlock(touch.clientY);
      if (block) showHandle(block.elem, block.key);
    }

    function onTouchMove(e: TouchEvent) {
      if (draggingKey) return;
      const touch = e.touches[0];
      if (!touch) return;
      const block = findBlock(touch.clientY);
      if (block) showHandle(block.elem, block.key);
      else scheduleHide();
    }

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

      const er = editorElem.getBoundingClientRect();
      const br = el.getBoundingClientRect();
      preview.style.display = "block";
      preview.style.left = `${br.left}px`;
      preview.style.width = `${br.width}px`;
      preview.style.height = `${draggingEl!.offsetHeight}px`;
      preview.style.top = `${above ? br.top - GAP : br.bottom}px`;
    }

    // ── DragOver / Drop (native DnD — desktop only) ─────────────────────────
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!draggingKey || !draggingEl) return;

      // Threshold check for native DnD (desktop)
      if (!dragMoved) {
        if (hasMovedEnough(e.clientX, e.clientY)) {
          activateDragVisuals();
        } else {
          return;
        }
      }

      const block = findBlock(e.clientY);
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
      if (usingTouch) return; // handled by touch polyfill
      finishDrag(e.clientY);
    };

    // ── Shared drag logic (called by both native DnD and touch polyfill) ─────
    function finishDrag(clientYVal: number) {
      // If the drag never moved past threshold — just cancel silently
      if (!dragMoved) {
        cleanupDrag();
        return;
      }

      clearGap();
      ghost.style.display = "none";
      if (!draggingKey || !draggingEl) return;

      const block = findBlock(clientYVal);
      if (!block || block.key === draggingKey) {
        cleanupDrag();
        return;
      }

      const targetKey = block.key;
      const br = block.elem.getBoundingClientRect();
      const above = clientYVal < br.top + br.height / 2;
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
    }

    function cleanupDrag() {
      ghost.style.display = "none";
      clearGap();
      if (draggingEl) {
        draggingEl.style.opacity = "";
        draggingEl = null;
      }
      draggingKey = null;
      usingTouch = false;
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

    // ── Drag start (native DnD — desktop) ───────────────────────────────────
    dragBtn.addEventListener("dragstart", (e: DragEvent) => {
      if (usingTouch) {
        e.preventDefault();
        return;
      }
      if (!hoveredKey) {
        e.preventDefault();
        return;
      }
      startDrag(e.clientX, e.clientY);

      // Suppress default browser icon
      const empty = document.createElement("img");
      empty.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer!.setDragImage(empty, 0, 0);

      const onDrag = (ev: DragEvent) => {
        if (ev.clientX === 0 && ev.clientY === 0) return;

        // Threshold check for native DnD
        if (!dragMoved) {
          if (hasMovedEnough(ev.clientX, ev.clientY)) {
            activateDragVisuals();
          } else {
            return;
          }
        }

        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      };
      document.addEventListener("dragover", onDrag);

      const onDragEnd = () => {
        document.removeEventListener("dragover", onDrag);
        document.removeEventListener("dragend", onDragEnd);
        cleanupDrag();
      };
      document.addEventListener("dragend", onDragEnd);
    });

    // ── Touch drag start (mobile polyfill) ───────────────────────────────────
    dragBtn.addEventListener("touchstart", (e: TouchEvent) => {
      if (!hoveredKey) return;
      // Prevent default so scroll doesn't interfere
      e.preventDefault();
      usingTouch = true;
      const touch = e.touches[0];
      if (!touch) return;
      startDrag(touch.clientX, touch.clientY);
      hideHandleEl();
    });

    /** Shared logic to initialise drag state and clone elements */
    function startDrag(startClientX: number, startClientY: number) {
      if (!hoveredKey) return;
      draggingKey = hoveredKey;

      const el = editor.getElementByKey(draggingKey);
      if (!el) {
        draggingKey = null;
        return;
      }

      draggingEl = el;

      // Just remember the start — ghost/preview appear only after threshold
      dragStartX = startClientX;
      dragStartY = startClientY;
      dragMoved = false;

      hideHandleEl();
    }

    /** Show ghost, preview, opacity change — called once we cross the threshold */
    function activateDragVisuals() {
      if (!draggingKey || !draggingEl || dragMoved) return;
      dragMoved = true;

      draggingEl.style.opacity = "0.25";

      // Ghost (follows cursor/finger)
      ghost.innerHTML = "";
      const clone = draggingEl.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, {
        width: `${draggingEl.offsetWidth}px`,
        height: `${draggingEl.offsetHeight}px`,
        overflow: "hidden",
        opacity: "1",
        margin: "0",
        transform: "none",
      });
      ghost.appendChild(clone);
      ghost.style.display = "block";
      ghost.style.left = `${dragStartX + 12}px`;
      ghost.style.top = `${dragStartY + 12}px`;

      // Insert preview
      preview.innerHTML = "";
      const pClone = draggingEl.cloneNode(true) as HTMLElement;
      Object.assign(pClone.style, {
        width: "100%",
        height: "100%",
        opacity: "1",
        margin: "0",
        transform: "none",
      });
      preview.appendChild(pClone);
    }

    /** True if the drag has moved past the threshold */
    function hasMovedEnough(cx: number, cy: number): boolean {
      const dx = cx - dragStartX;
      const dy = cy - dragStartY;
      return Math.sqrt(dx * dx + dy * dy) >= MIN_DRAG_DISTANCE;
    }

    // ── Common drag-move (called by both mouse drag and touch) ──────────────
    function moveDrag(clientXVal: number, clientYVal: number) {
      if (!draggingKey || !draggingEl) return;

      // Don't do anything until the threshold is crossed
      if (!dragMoved) {
        if (hasMovedEnough(clientXVal, clientYVal)) {
          activateDragVisuals();
        } else {
          return; // still too close to start — ignore
        }
      }

      ghost.style.left = `${clientXVal + 12}px`;
      ghost.style.top = `${clientYVal + 12}px`;

      const block = findBlock(clientYVal);
      if (!block || block.key === draggingKey) {
        clearGap();
        return;
      }

      const br = block.elem.getBoundingClientRect();
      const above = clientYVal < br.top + br.height / 2;
      openGap(block.elem, above);
    }

    // ── Touch move / end (mobile polyfill) ───────────────────────────────────
    function onTouchDragMove(e: TouchEvent) {
      if (!usingTouch || !draggingKey) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      moveDrag(touch.clientX, touch.clientY);
    }

    function onTouchDragEnd(e: TouchEvent) {
      if (!usingTouch) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (!touch) return;
      finishDrag(touch.clientY);
    }

    // ── Register ─────────────────────────────────────────────────────────────
    editorElem.addEventListener("mousemove", onMouseMove);
    editorElem.addEventListener("mouseleave", onMouseLeave);
    editorElem.addEventListener("dragover", onDragOver);
    editorElem.addEventListener("drop", onDrop);

    // Touch: show handle when tapping on a block
    editorElem.addEventListener("touchstart", onTouchStart, { passive: true });
    editorElem.addEventListener("touchmove", onTouchMove, { passive: true });

    // Touch: listen on document for drag move/end (finger may leave editor)
    document.addEventListener("touchmove", onTouchDragMove, { passive: false });
    document.addEventListener("touchend", onTouchDragEnd);

    const scrollParent = editorElem.parentElement;
    scrollParent?.addEventListener("scroll", onScroll);

    onCleanup(() => {
      editorElem.removeEventListener("mousemove", onMouseMove);
      editorElem.removeEventListener("mouseleave", onMouseLeave);
      editorElem.removeEventListener("dragover", onDragOver);
      editorElem.removeEventListener("drop", onDrop);
      editorElem.removeEventListener("touchstart", onTouchStart);
      editorElem.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchmove", onTouchDragMove);
      document.removeEventListener("touchend", onTouchDragEnd);
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
