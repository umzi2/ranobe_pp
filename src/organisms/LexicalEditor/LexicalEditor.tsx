import { useEditor } from "~/molecules/LexicalEditor/useEditor";
import { useRichTextPlugin } from "./lib/useRichTextPlugin";
import { useDraggableBlockPlugin } from "./plugins/useDraggableBlock";
import { onMount, onCleanup } from "solid-js";
import "./LexicalEditor.scss";

export function LexicalEditor() {
  const editor = useEditor();
  let editorRef: HTMLDivElement | undefined;

  const getEditorRef = () => editorRef;

  useRichTextPlugin(editor, getEditorRef);
  useDraggableBlockPlugin(editor, getEditorRef);

  // Console output of full state on every change
  onMount(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      const json = editorState.toJSON();
      console.group("%c📝 Lexical state", "color:#818cf8;font-weight:600");
      console.log(JSON.stringify(json, null, 2));
      console.groupEnd();
    });
    onCleanup(unregister);
  });

  return (
    <div class="Lexica">
      <div
        ref={el => (editorRef = el)}
        contentEditable={true}
        spellcheck={false}
        class="Lexica_editor"
        data-placeholder="Start writing…"
      />
    </div>
  );
}