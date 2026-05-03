import { useEditor } from "~/molecules/LexicalEditor/useEditor";
import { useRichTextPlugin } from "./lib/useRichTextPlugin";
import { useDraggableBlockPlugin } from "./plugins/useDraggableBlock";
import "./LexicalEditor.scss";

export function LexicalEditor() {
  const editor = useEditor();
  let editorRef: HTMLDivElement | undefined;

  const getEditorRef = () => editorRef;

  useRichTextPlugin(editor, getEditorRef);
  useDraggableBlockPlugin(editor, getEditorRef);

  return (
    <div class="Lexica">
      <div
        ref={el => (editorRef = el)}
        contentEditable={true}
        spellcheck={false}
        class="Lexica_editor"
        data-placeholder="Type something… hover a block to drag it"
      />
    </div>
  );
}