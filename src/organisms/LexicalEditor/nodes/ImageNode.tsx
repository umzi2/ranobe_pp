import {
  DecoratorNode,
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";

export type SerializedImageNode = Spread<
  { src: string; alt: string; type: "image"; version: 1 },
  SerializedLexicalNode
>;

export class ImageNode extends DecoratorNode<null> {
  __src: string;
  __alt: string;

  static getType(): string { return "image"; }
  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__key);
  }

  constructor(src: string, alt: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
  }

  // All rendering in createDOM — no React/Solid adapter needed
  createDOM(_config: EditorConfig): HTMLElement {
    const figure = document.createElement("figure");
    figure.className = "lx-image-wrapper";
    figure.contentEditable = "false";

    const img = document.createElement("img");
    img.src = this.__src;
    img.alt = this.__alt;
    img.className = "lx-image";
    img.onerror = () => {
      img.style.display = "none";
      if (!figure.querySelector(".lx-image-error")) {
        const err = document.createElement("div");
        err.className = "lx-image-error";
        err.textContent = "⚠ Не удалось загрузить изображение";
        figure.appendChild(err);
      }
    };

    figure.appendChild(img);
    return figure;
  }

  updateDOM(prev: ImageNode, dom: HTMLElement): boolean {
    if (prev.__src !== this.__src) {
      const img = dom.querySelector("img") as HTMLImageElement | null;
      if (img) { img.src = this.__src; img.style.display = ""; }
      dom.querySelector(".lx-image-error")?.remove();
    }
    if (prev.__alt !== this.__alt) {
      const img = dom.querySelector("img") as HTMLImageElement | null;
      if (img) img.alt = this.__alt;
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
            (el as HTMLImageElement).alt ?? ""
          ),
        }),
        priority: 0,
      }),
    };
  }

  exportJSON(): SerializedImageNode {
    return { src: this.__src, alt: this.__alt, type: "image", version: 1 };
  }
  static importJSON(data: SerializedImageNode): ImageNode {
    return $createImageNode(data.src, data.alt);
  }

  decorate(): null { return null; }
  isInline(): boolean { return false; }
  isIsolated(): boolean { return true; }
}

export function $createImageNode(src: string, alt = ""): ImageNode {
  return new ImageNode(src, alt);
}
export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}