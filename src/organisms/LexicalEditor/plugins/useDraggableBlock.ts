import { onMount, onCleanup, Accessor } from 'solid-js';
import { $createParagraphNode, $getNodeByKey, $getRoot, LexicalEditor } from 'lexical';

export function useDraggableBlockPlugin(
  editor: LexicalEditor,
  editorElemAccessor: Accessor<HTMLElement | undefined>
) {
  onMount(() => {
    const editorElem = editorElemAccessor();
    if (!editorElem) return;

    // ── DOM: floating handle ─────────────────────────────────────────────────
    const handle = document.createElement('div');
    handle.className = 'nbc-handle';
    handle.innerHTML = `
      <button class="nbc-btn nbc-add" title="Add block below">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="nbc-btn nbc-drag" draggable="true" title="Drag to reorder">
        <svg width="10" height="14" viewBox="0 0 10 14">
          <circle cx="3" cy="2.5"  r="1.3" fill="currentColor"/>
          <circle cx="7" cy="2.5"  r="1.3" fill="currentColor"/>
          <circle cx="3" cy="7"    r="1.3" fill="currentColor"/>
          <circle cx="7" cy="7"    r="1.3" fill="currentColor"/>
          <circle cx="3" cy="11.5" r="1.3" fill="currentColor"/>
          <circle cx="7" cy="11.5" r="1.3" fill="currentColor"/>
        </svg>
      </div>
    `;
    Object.assign(handle.style, {
      position: 'fixed',
      display: 'none',
      alignItems: 'center',
      gap: '2px',
      zIndex: '9999',
      userSelect: 'none',
    });

    // ── DOM: drop indicator line ─────────────────────────────────────────────
    const dropLine = document.createElement('div');
    dropLine.className = 'nbc-drop-line';
    Object.assign(dropLine.style, {
      position: 'fixed',
      display: 'none',
      height: '2px',
      background: '#2383e2',
      pointerEvents: 'none',
      zIndex: '9999',
      borderRadius: '2px',
      boxShadow: '0 0 0 2px rgba(35,131,226,0.15)',
    });

    document.body.appendChild(handle);
    document.body.appendChild(dropLine);

    // ── State ────────────────────────────────────────────────────────────────
    let hoveredKey: string | null = null;
    let draggingKey: string | null = null;
    let overHandle = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Helpers ──────────────────────────────────────────────────────────────
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
      handle.style.top  = `${br.top + br.height / 2 - 13}px`;
      handle.style.left = `${er.left + 14}px`;
      handle.style.display = 'flex';
    }

    function scheduleHide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!overHandle) {
          handle.style.display = 'none';
          hoveredKey = null;
        }
        hideTimer = null;
      }, 180);
    }

    // ── Editor mouse events ──────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const block = findBlock(e.clientY);
      if (block) showHandle(block.elem, block.key);
      else scheduleHide();
    };

    const onMouseLeave = () => scheduleHide();

    // ── Drag over / drop on the editor ───────────────────────────────────────
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!draggingKey) return;

      const block = findBlock(e.clientY);
      if (!block || block.key === draggingKey) {
        dropLine.style.display = 'none';
        return;
      }

      const er = editorElem.getBoundingClientRect();
      const br = block.elem.getBoundingClientRect();
      const above = e.clientY < br.top + br.height / 2;

      dropLine.style.top   = `${(above ? br.top : br.bottom) - 1}px`;
      dropLine.style.left  = `${er.left + 6}px`;
      dropLine.style.width = `${er.width - 12}px`;
      dropLine.style.display = 'block';
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dropLine.style.display = 'none';
      if (!draggingKey) return;

      const block = findBlock(e.clientY);
      if (!block || block.key === draggingKey) return;

      const targetKey = block.key;
      const br  = block.elem.getBoundingClientRect();
      const above = e.clientY < br.top + br.height / 2;
      const dk = draggingKey;

      editor.update(() => {
        const dragged = $getNodeByKey(dk);
        const target  = $getNodeByKey(targetKey);
        if (!dragged || !target) return;
        dragged.remove();
        if (above) target.insertBefore(dragged);
        else       target.insertAfter(dragged);
      });
    };

    // ── Handle hover ─────────────────────────────────────────────────────────
    handle.addEventListener('mouseenter', () => {
      overHandle = true;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    handle.addEventListener('mouseleave', () => {
      overHandle = false;
      scheduleHide();
    });

    // ── Drag handle – start/end ───────────────────────────────────────────────
    const dragBtn = handle.querySelector('.nbc-drag') as HTMLElement;

    dragBtn?.addEventListener('dragstart', (e: DragEvent) => {
      if (!hoveredKey) { e.preventDefault(); return; }
      draggingKey = hoveredKey;
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', draggingKey);

      const el = editor.getElementByKey(draggingKey);
      if (el) {
        // ghost image = the block itself
        e.dataTransfer!.setDragImage(el, 20, el.offsetHeight / 2);
        el.style.opacity = '0.35';
      }
      handle.style.display = 'none';
    });

    dragBtn?.addEventListener('dragend', () => {
      if (draggingKey) {
        const el = editor.getElementByKey(draggingKey);
        if (el) el.style.opacity = '';
      }
      dropLine.style.display = 'none';
      draggingKey = null;
    });

    // ── Add block button ──────────────────────────────────────────────────────
    const addBtn = handle.querySelector('.nbc-add') as HTMLElement;
    addBtn?.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault(); // keep editor focus
      if (!hoveredKey) return;
      const key = hoveredKey;
      editor.update(() => {
        const node = $getNodeByKey(key);
        if (!node) return;
        const para = $createParagraphNode();
        node.insertAfter(para);
        para.select();
      });
      // keep handle visible on new block
      requestAnimationFrame(() => {
        const newKeys = getBlockKeys();
        const idx = newKeys.indexOf(key);
        if (idx !== -1 && newKeys[idx + 1]) {
          const newElem = editor.getElementByKey(newKeys[idx + 1]);
          if (newElem) showHandle(newElem, newKeys[idx + 1]);
        }
      });
    });

    // ── Register ─────────────────────────────────────────────────────────────
    editorElem.addEventListener('mousemove',  onMouseMove);
    editorElem.addEventListener('mouseleave', onMouseLeave);
    editorElem.addEventListener('dragover',   onDragOver);
    editorElem.addEventListener('drop',       onDrop);

    onCleanup(() => {
      editorElem.removeEventListener('mousemove',  onMouseMove);
      editorElem.removeEventListener('mouseleave', onMouseLeave);
      editorElem.removeEventListener('dragover',   onDragOver);
      editorElem.removeEventListener('drop',       onDrop);
      if (hideTimer) clearTimeout(hideTimer);
      if (document.body.contains(handle))   document.body.removeChild(handle);
      if (document.body.contains(dropLine)) document.body.removeChild(dropLine);
    });
  });
}