import {
  $createNodeSelection,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";

export type SerializedHorizontalRuleNode = Spread<
  { type: "horizontal-rule"; version: 1 },
  SerializedLexicalNode
>;

export class HorizontalRuleNode extends DecoratorNode<null> {
  static getType(): string {
    return "horizontal-rule";
  }
  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(_config: EditorConfig, editor: LexicalEditor): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "lx-hr-wrapper";
    wrapper.contentEditable = "false";
    wrapper.setAttribute("data-key", this.__key);

    const hr = document.createElement("hr");
    hr.className = "lx-hr";
    wrapper.appendChild(hr);

    const key = this.__key;
    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      editor.update(() => {
        const curSel = $getSelection();
        if ($isNodeSelection(curSel) && curSel.has(key)) return;
        const sel = $createNodeSelection();
        sel.add(key);
        $setSelection(sel);
      });
    });

    return wrapper;
  }

  updateDOM(): boolean {
    return false;
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return { type: "horizontal-rule", version: 1 };
  }
  static importJSON(): HorizontalRuleNode {
    return $createHorizontalRuleNode();
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

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode();
}
export function $isHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}
