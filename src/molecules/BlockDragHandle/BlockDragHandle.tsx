// import "./Blockdraghandle.module.scss"
export interface DragHandleElements {
  handle: HTMLElement;
  dragBtn: HTMLElement;
  destroy: () => void;
}

export function createDragHandle(): DragHandleElements {
  const handle = document.createElement("div");
  handle.className = "block-drag-handle";
  handle.innerHTML = `
    <div class="bdh-grip" draggable="true" title="Drag to reorder" role="button" aria-label="Drag block">
      <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
        <circle cx="3"  cy="2.5"  r="1.3" fill="currentColor"/>
        <circle cx="7"  cy="2.5"  r="1.3" fill="currentColor"/>
        <circle cx="3"  cy="7"    r="1.3" fill="currentColor"/>
        <circle cx="7"  cy="7"    r="1.3" fill="currentColor"/>
        <circle cx="3"  cy="11.5" r="1.3" fill="currentColor"/>
        <circle cx="7"  cy="11.5" r="1.3" fill="currentColor"/>
      </svg>
    </div>
  `;

  Object.assign(handle.style, {
    position: "fixed",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "9999",
    userSelect: "none",
    pointerEvents: "auto",
  });

  document.body.appendChild(handle);
  const dragBtn = handle.querySelector(".bdh-grip") as HTMLElement;

  return {
    handle,
    dragBtn,
    destroy: () => {
      if (document.body.contains(handle)) document.body.removeChild(handle);
    },
  };
}