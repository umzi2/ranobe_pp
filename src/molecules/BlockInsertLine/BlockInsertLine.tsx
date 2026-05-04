export type InsertPosition = "before" | "after";

export interface InsertLineElements {
  line: HTMLElement;
  setVisible: (visible: boolean, x: number, y: number, width: number) => void;
  destroy: () => void;
}

export function createInsertLine(
  onInsert: (position: InsertPosition) => void
): InsertLineElements {
  const line = document.createElement("div");
  line.className = "block-insert-line";
  line.innerHTML = `
    <div class="bil-track">
      <button class="bil-btn" type="button" aria-label="Add block">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 1v8M1 5h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  Object.assign(line.style, {
    position: "fixed",
    display: "none",
    zIndex: "9998",
    pointerEvents: "none",
  });

  document.body.appendChild(line);

  const btn = line.querySelector(".bil-btn") as HTMLButtonElement;
  const track = line.querySelector(".bil-track") as HTMLElement;

  track.style.pointerEvents = "auto";

  btn.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener("click", (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = (line.dataset.insertPosition as InsertPosition) ?? "after";
    onInsert(pos);
  });

  return {
    line,
    setVisible(visible: boolean, x: number, y: number, width: number) {
      if (!visible) {
        line.style.display = "none";
        return;
      }
      // 20px tall, centered on the edge between blocks
      Object.assign(line.style, {
        display: "block",
        top:    `${y - 10}px`,  // center the 20px zone on the edge
        left:   `${x}px`,
        width:  `${width}px`,
        height: "20px",
      });
    },
    destroy: () => {
      if (document.body.contains(line)) document.body.removeChild(line);
    },
  };
}