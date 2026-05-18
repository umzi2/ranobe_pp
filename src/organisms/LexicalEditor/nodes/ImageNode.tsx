import {
  $getSelection,
  $setSelection,
  $isNodeSelection,
  $createNodeSelection,
  DecoratorNode,
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";

export type ImageAlignment = "left" | "center" | "right" | "none";
/**
 * px            — фиксированная ширина в пикселях
 * img-percent   — процент от ОРИГИНАЛЬНОГО размера изображения
 * block-percent — процент от ширины блока редактора (заполнение), макс 100%
 */
export type ImageWidthType = "px" | "img-percent" | "block-percent";

export type SerializedImageNode = Spread<
  {
    src: string;
    alt: string;
    alignment: ImageAlignment;
    width: number;
    widthType: ImageWidthType;
    type: "image";
    version: 1;
  },
  SerializedLexicalNode
>;

const WIDTH_OPTIONS: { label: string; value: ImageWidthType }[] = [
  { label: "px", value: "px" },
  { label: "%img", value: "img-percent" },
  { label: "%block", value: "block-percent" },
];

export class ImageNode extends DecoratorNode<null> {
  __src: string;
  __alt: string;
  __alignment: ImageAlignment;
  __width: number;
  __widthType: ImageWidthType;

  static getType(): string {
    return "image";
  }
  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__alt,
      node.__alignment,
      node.__width,
      node.__widthType,
      node.__key,
    );
  }

  constructor(
    src: string,
    alt = "",
    alignment: ImageAlignment = "center",
    width = 0,
    widthType: ImageWidthType = "px",
    key?: NodeKey,
  ) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__alignment = alignment;
    this.__width = width;
    this.__widthType = widthType;
  }

  getSrc(): string {
    return this.getLatest().__src;
  }
  setSrc(src: string): void {
    const s = this.getWritable();
    s.__src = src;
  }

  getAlignment(): ImageAlignment {
    return this.getLatest().__alignment;
  }
  setAlignment(alignment: ImageAlignment): void {
    const s = this.getWritable();
    s.__alignment = alignment;
  }
  getWidth(): number {
    return this.getLatest().__width;
  }
  setWidth(width: number): void {
    const s = this.getWritable();
    s.__width = width;
  }
  getWidthType(): ImageWidthType {
    return this.getLatest().__widthType;
  }
  setWidthType(widthType: ImageWidthType): void {
    const s = this.getWritable();
    s.__widthType = widthType;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sizing
  // ─────────────────────────────────────────────────────────────────────────

  private applyImageSize(img: HTMLImageElement, editorBlockWidth = 0): void {
    if (this.__width <= 0) {
      img.style.width = "";
      img.style.height = "auto";
      return;
    }
    switch (this.__widthType) {
      case "px":
        img.style.width = `${this.__width}px`;
        img.style.height = "auto";
        break;
      case "img-percent": {
        const nw = img.naturalWidth;
        if (nw > 0) {
          img.style.width = `${Math.round((nw * this.__width) / 100)}px`;
        } else {
          // Image not yet loaded — defer sizing until it loads
          img.style.width = "";
          const onLoad = () => {
            const loadedW = img.naturalWidth;
            if (loadedW > 0) {
              img.style.width = `${Math.round((loadedW * this.__width) / 100)}px`;
            }
            img.removeEventListener("load", onLoad);
          };
          img.addEventListener("load", onLoad);
        }
        img.style.height = "auto";
        break;
      }
      case "block-percent": {
        const bw =
          editorBlockWidth > 0
            ? editorBlockWidth
            : (img.parentElement?.clientWidth ?? 0);
        img.style.width = `${Math.round((bw * Math.min(this.__width, 100)) / 100)}px`;
        img.style.height = "auto";
        break;
      }
    }
  }

  private getEditorBlockWidth(figure: HTMLElement): number {
    return (
      figure.closest(".Lexica_editor")?.clientWidth ??
      figure.parentElement?.clientWidth ??
      0
    );
  }

  private applyImageStyle(figure: HTMLElement, img: HTMLImageElement): void {
    figure.style.display = "table";
    switch (this.__alignment) {
      case "left":
        figure.style.marginLeft = "0";
        figure.style.marginRight = "auto";
        break;
      case "center":
        figure.style.marginLeft = "auto";
        figure.style.marginRight = "auto";
        break;
      case "right":
        figure.style.marginLeft = "auto";
        figure.style.marginRight = "0";
        break;
      default:
        figure.style.marginLeft = "";
        figure.style.marginRight = "";
        break;
    }
    this.applyImageSize(img, this.getEditorBlockWidth(figure));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Inline toolbar (Notion-style, inside the block, below the image)
  // ─────────────────────────────────────────────────────────────────────────

  /** (re)build the toolbar to reflect current state */
  private syncToolbar(
    toolbar: HTMLElement,
    overrides?: {
      alignment?: ImageAlignment;
      width?: number;
      widthType?: ImageWidthType;
    },
  ): void {
    // Используем переданные значения (из event handler, вне editor.update)
    // либо поля текущей ноды (из updateDOM, где this — уже свежая нода)
    const align = overrides?.alignment ?? this.__alignment;
    const width = overrides?.width ?? this.__width;
    const widthType = overrides?.widthType ?? this.__widthType;

    // ── alignment buttons ──
    const alignBtns =
      toolbar.querySelectorAll<HTMLButtonElement>(".lx-itb-align");
    for (const btn of alignBtns) {
      btn.classList.toggle("pressed", btn.dataset.align === align);
    }

    // ── width input ──
    const widthInput = toolbar.querySelector<HTMLInputElement>(".lx-itb-input");
    if (widthInput) {
      widthInput.value = width > 0 ? String(width) : "";
      widthInput.max = String(widthType === "block-percent" ? 100 : 99999);
    }

    // ── unit select ──
    const unitSel = toolbar.querySelector<HTMLSelectElement>(".lx-itb-select");
    if (unitSel) unitSel.value = widthType;
  }

  /** Create the inline toolbar element (hidden by default, shown via .lx-image-selected) */
  private createToolbar(editor: LexicalEditor): HTMLElement {
    const self = this;
    const tb = document.createElement("div");
    tb.className = "lx-image-block-toolbar";

    // ── alignment ──
    const alignGroup = document.createElement("div");
    alignGroup.className = "lx-itb-group";
    for (const a of [
      { value: "left" as ImageAlignment, label: "↤", title: "Влево" },
      { value: "center" as ImageAlignment, label: "↔", title: "Центр" },
      { value: "right" as ImageAlignment, label: "↦", title: "Вправо" },
    ]) {
      const btn = document.createElement("button");
      btn.className = "lx-itb-btn lx-itb-align";
      btn.dataset.align = a.value;
      btn.textContent = a.label;
      btn.title = a.title;
      btn.type = "button";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        editor.update(() => {
          self.setAlignment(a.value);
        });
        self.syncToolbar(tb, { alignment: a.value });
      });
      alignGroup.appendChild(btn);
    }
    tb.appendChild(alignGroup);

    // separator
    tb.appendChild(this.createSep());

    // ── width input with vertical spinners on the right ──
    const wGroup = document.createElement("div");
    wGroup.className = "lx-itb-group";

    const wInput = document.createElement("input");
    wInput.type = "number";
    wInput.min = "0";
    wInput.className = "lx-itb-input";
    wInput.placeholder = "auto";

    const updateWidth = () => {
      const val = Number(wInput.value) || 0;
      editor.update(() => {
        self.setWidth(val);
      });
      self.syncToolbar(tb, { width: val });
    };

    wInput.addEventListener("input", updateWidth);

    // step logic with limits
    const maxVal = () => (self.__widthType === "block-percent" ? 100 : 99999);
    const step = (dir: number) => {
      const cur = Number(wInput.value) || 0;
      const stepVal = 10;
      const next = Math.max(0, Math.min(maxVal(), cur + dir * stepVal));
      wInput.value = String(next);
      editor.update(() => {
        self.setWidth(next);
      });
      self.syncToolbar(tb, { width: next });
    };

    // vertical spinners container (right side of input)
    const spinners = document.createElement("div");
    spinners.className = "lx-itb-spinners";

    const btnUp = document.createElement("button");
    btnUp.className = "lx-itb-spin lx-itb-spin-up";
    btnUp.textContent = "▲";
    btnUp.type = "button";
    btnUp.tabIndex = -1;
    btnUp.title = "Увеличить";
    btnUp.addEventListener("click", (e) => {
      e.stopPropagation();
      step(1);
    });

    const btnDown = document.createElement("button");
    btnDown.className = "lx-itb-spin lx-itb-spin-down";
    btnDown.textContent = "▼";
    btnDown.type = "button";
    btnDown.tabIndex = -1;
    btnDown.title = "Уменьшить";
    btnDown.addEventListener("click", (e) => {
      e.stopPropagation();
      step(-1);
    });

    spinners.appendChild(btnUp);
    spinners.appendChild(btnDown);

    wGroup.appendChild(wInput);
    wGroup.appendChild(spinners);

    const wSelect = document.createElement("select");
    wSelect.className = "lx-itb-select";
    for (const opt of WIDTH_OPTIONS) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      wSelect.appendChild(el);
    }
    wSelect.addEventListener("change", (e) => {
      const val = (e.target as HTMLSelectElement).value as ImageWidthType;
      editor.update(() => {
        self.setWidthType(val);
      });
      self.syncToolbar(tb, { widthType: val });
    });
    wGroup.appendChild(wSelect);
    tb.appendChild(wGroup);

    // separator
    tb.appendChild(this.createSep());

    // ── delete ──
    const delBtn = document.createElement("button");
    delBtn.className = "lx-itb-btn lx-itb-del";
    delBtn.textContent = "✕";
    delBtn.title = "Удалить";
    delBtn.type = "button";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.update(() => {
        const sel = $createNodeSelection();
        sel.add(self.__key);
        $setSelection(sel);
        self.remove();
      });
    });
    tb.appendChild(delBtn);

    return tb;
  }

  private createSep(): HTMLElement {
    const sep = document.createElement("span");
    sep.setAttribute("role", "separator");
    sep.setAttribute("data-orientation", "vertical");
    sep.className = "lx-itb-sep";
    return sep;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  private attachClickHandler(figure: HTMLElement, editor: LexicalEditor): void {
    const key = this.__key;
    figure.addEventListener("click", (e) => {
      e.stopPropagation();
      editor.update(() => {
        const curSel = $getSelection();
        if ($isNodeSelection(curSel) && curSel.has(key)) return;
        const sel = $createNodeSelection();
        sel.add(key);
        $setSelection(sel);
      });
    });
  }

  createDOM(_config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "lx-image-wrapper";
    figure.contentEditable = "false";

    this.attachClickHandler(figure, editor);

    const img = document.createElement("img");
    img.src = this.__src;
    img.alt = this.__alt;
    img.className = "lx-image";
    img.draggable = false;

    img.onerror = () => {
      img.style.display = "none";
      if (!figure.querySelector(".lx-image-error")) {
        const err = document.createElement("div");
        err.className = "lx-image-error";
        err.textContent = "⚠ Не удалось загрузить изображение";
        figure.appendChild(err);
      }
    };

    if (this.__width > 0) {
      img.onload = () => {
        this.applyImageSize(img, this.getEditorBlockWidth(figure));
      };
    }

    this.applyImageStyle(figure, img);
    figure.appendChild(img);

    // Inline toolbar — built once, shown/hidden via CSS on selection
    const toolbar = this.createToolbar(editor);
    figure.appendChild(toolbar);

    return figure;
  }

  updateDOM(prev: ImageNode, dom: HTMLElement): boolean {
    const img = dom.querySelector<HTMLImageElement>("img");
    if (prev.__src !== this.__src) {
      if (img) {
        img.src = this.__src;
        img.style.display = "";
      }
      dom.querySelector(".lx-image-error")?.remove();
    }
    if (prev.__alt !== this.__alt && img) img.alt = this.__alt;
    if (
      prev.__alignment !== this.__alignment ||
      prev.__width !== this.__width ||
      prev.__widthType !== this.__widthType
    ) {
      if (img) this.applyImageStyle(dom, img);
      // sync inline toolbar state
      const tb = dom.querySelector<HTMLElement>(".lx-image-block-toolbar");
      if (tb) this.syncToolbar(tb);
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.src = this.__src;
    img.alt = this.__alt;
    return { element: img };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (el) => ({
          node: $createImageNode(
            (el as HTMLImageElement).src ?? "",
            (el as HTMLImageElement).alt ?? "",
          ),
        }),
        priority: 0,
      }),
    };
  }

  exportJSON(): SerializedImageNode {
    return {
      src: this.__src,
      alt: this.__alt,
      alignment: this.__alignment,
      width: this.__width,
      widthType: this.__widthType,
      type: "image",
      version: 1,
    };
  }

  static importJSON(data: SerializedImageNode): ImageNode {
    return $createImageNode(
      data.src,
      data.alt,
      data.alignment ?? "center",
      data.width ?? 0,
      data.widthType ?? "px",
    );
  }

  decorate(): null {
    return null;
  }
  isInline(): boolean {
    return false;
  }
  isIsolated(): boolean {
    return true;
  }
}

export function $createImageNode(
  src: string,
  alt = "",
  alignment: ImageAlignment = "center",
  width = 0,
  widthType: ImageWidthType = "px",
): ImageNode {
  return new ImageNode(src, alt, alignment, width, widthType);
}
export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}
