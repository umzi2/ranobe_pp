import { createEditor, LexicalEditor,  type CreateEditorArgs } from "lexical";
import { createContext, useContext, type ParentProps } from "solid-js";
export const EditorContext = createContext<LexicalEditor>(undefined);
export function useEditor(): LexicalEditor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error("useEditor must be used inside RichTextEditor");
  return editor;
}

interface EditorProviderProps extends ParentProps {
  config: CreateEditorArgs;
}

export function EditorProvider(props: EditorProviderProps) {
  const editor = createEditor(props.config);
  return <EditorContext.Provider value={editor}>{props.children}</EditorContext.Provider>;
}