export interface DragHandleElements {
  handle: HTMLElement;
  dragBtn: HTMLElement;
  /** Update position — called by consumer on hover/scroll */
  moveTo: (x: number, y: number) => void;
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

export function createDragHandle(): DragHandleElements {
  const handle = document.createElement("div");
  handle.className = "block-drag-handle";
  handle.innerHTML = `
    <div class="bdh-grip" draggable="true" title="Drag to reorder" role="button" aria-label="Drag block">
      <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
        <circle cx="3" cy="2.5" r="1.3" fill="currentColor"/>
        <circle cx="7" cy="2.5" r="1.3" fill="currentColor"/>
        <circle cx="3" cy="7"   r="1.3" fill="currentColor"/>
        <circle cx="7" cy="7"   r="1.3" fill="currentColor"/>
        <circle cx="3" cy="11.5" r="1.3" fill="currentColor"/>
        <circle cx="7" cy="11.5" r="1.3" fill="currentColor"/>
      </svg>
    </div>
  `;

  document.body.appendChild(handle);
  const dragBtn = handle.querySelector(".bdh-grip") as HTMLElement;

  return {
    handle,
    dragBtn,
    moveTo: (x: number, y: number) => {
      handle.style.left = `${x}px`;
      handle.style.top = `${y}px`;
    },
    show: () => {
      handle.style.display = "flex";
    },
    hide: () => {
      handle.style.display = "none";
    },
    destroy: () => {
      if (document.body.contains(handle)) document.body.removeChild(handle);
    },
  };
}
