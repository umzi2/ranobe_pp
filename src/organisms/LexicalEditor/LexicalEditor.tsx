import { useEditor } from "~/molecules/LexicalEditor/useEditor";
import { useRichTextPlugin } from "./lib/useRichTextPlugin";
import {  createSignal } from "solid-js";
import "./LexicalEditor.scss"

export function LexicalEditor() {
  const editor = useEditor();
  let editorRef: HTMLDivElement | undefined;
  const [formattedJson, setFormattedJson] = createSignal("");

  const getEditorRef = () => editorRef;

  useRichTextPlugin(editor, getEditorRef);

  editor.registerUpdateListener(({ editorState }) => {
    const serializedState = editorState.toJSON();
    
    const prettyJsonString = JSON.stringify(serializedState, null, 2);
    
    setFormattedJson(prettyJsonString);
    
  });

  return (
    <div class="Lexica">
      <div class="portal">
        <div
          ref={el => editorRef = el}  
          contentEditable={true}
          spellcheck={false}
          class="Lexica_2"
          data-placeholder="Write a comment..."
        />
        
      </div>
     
      {/*<div class="json-viewer">
        <h4>Состояние редактора (JSON):</h4>
        <pre>{formattedJson()}</pre>
      </div>*/}
    </div>
  );
}