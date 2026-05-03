import { onMount, onCleanup, Accessor } from 'solid-js';
import { registerRichText } from '@lexical/rich-text';
import { $createParagraphNode, $getRoot, LexicalEditor } from 'lexical';
import { mergeRegister } from 'lexical';

export function useRichTextPlugin(
  editor: LexicalEditor,
  rootElementAccessor: Accessor<HTMLDivElement | undefined>
) {
  onMount(() => {
    const rootElement = rootElementAccessor();
    if (!rootElement) {
      console.error('Root element not available in useRichTextPlugin');
      return;
    }

    editor.setRootElement(rootElement);

    const unregister = mergeRegister(registerRichText(editor));

    editor.update(() => {
      const root = $getRoot();
      if (root.getFirstChild() === null) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      }
      
    }
    
    );

    onCleanup(() => {
      unregister();
      editor.setRootElement(null);
    });
  });
}