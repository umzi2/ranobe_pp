import { onMount, onCleanup, Accessor } from "solid-js";
import { registerRichText } from "@lexical/rich-text";
import { registerLink, registerClickableLink } from "@lexical/link";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { $createParagraphNode, $getRoot, LexicalEditor } from "lexical";
import { mergeRegister } from "lexical";

/** Shared history state so toolbar can check undo/redo stack */
export const historyState = createEmptyHistoryState();

export function useRichTextPlugin(
  editor: LexicalEditor,
  rootElementAccessor: Accessor<HTMLDivElement | undefined>,
) {
  onMount(() => {
    const rootElement = rootElementAccessor();
    if (!rootElement) {
      console.error("Root element not available in useRichTextPlugin");
      return;
    }

    editor.setRootElement(rootElement);

    // Simple stores for registerLink + registerClickableLink
    const linkStores = {
      disabled: {
        peek: () => false as boolean,
        value: false as boolean,
      },
      newTab: {
        peek: () => false as boolean,
        value: false as boolean,
      },
      validateUrl: {
        peek: () => undefined as ((url: string) => boolean) | undefined,
        value: undefined as ((url: string) => boolean) | undefined,
      },
      attributes: {
        peek: () => undefined as Record<string, string> | undefined,
        value: undefined as Record<string, string> | undefined,
      },
    };

    const unregister = mergeRegister(
      registerRichText(editor),
      registerLink(editor, linkStores as any),
      registerClickableLink(editor, linkStores as any),
      registerHistory(editor, historyState, 300),
    );

    editor.update(() => {
      const root = $getRoot();
      if (root.getFirstChild() === null) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      }
    });

    onCleanup(() => {
      unregister();
      editor.setRootElement(null);
    });
  });
}
