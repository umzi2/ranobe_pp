import {
  ElementNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical";

export type SerializedQuoteNode = Spread<
  { type: "quote"; version: 1 },
  SerializedElementNode
>;

export class QuoteNode extends ElementNode {
  static getType(): string {
    return "quote";
  }

  static clone(node: QuoteNode): QuoteNode {
    return new QuoteNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const el = document.createElement("blockquote");
    el.className = "lx-quote";
    return el;
  }

  updateDOM(): boolean {
    return false;
  }

  isShadowRoot(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return false;
  }

  exportJSON(): SerializedQuoteNode {
    return {
      ...super.exportJSON(),
      type: "quote",
      version: 1,
    };
  }

  static importJSON(data: SerializedQuoteNode): QuoteNode {
    const node = $createQuoteNode();
    return node;
  }
}

export function $createQuoteNode(): QuoteNode {
  return new QuoteNode();
}

export function $isQuoteNode(
  node: LexicalNode | null | undefined,
): node is QuoteNode {
  return node instanceof QuoteNode;
}
