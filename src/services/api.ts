import type { LexicalEditor } from "lexical";
import {
  lexicalToDocument,
  documentToLexical,
  type LexicalNode,
} from "./lexical-proto";
import {
  saveEditor,
  editEditor,
  editorToDocument,
  type Document,
} from "~/gen/lexical-rpc";

/**
 * API service for interacting with the backend.
 * Currently logs editor state; will be wired to real endpoints later.
 */

export interface EditorPayload {
  namespace: string;
  timestamp: string;
  state: string; // serialised Lexical JSON
  proto?: Document; // proto representation (generated type)
}

/**
 * Read the current editor state as a plain Lexical JSON node.
 */
export function readEditorStateJson(editor: LexicalEditor): LexicalNode {
  const raw = editor.getEditorState().toJSON() as unknown as Record<
    string,
    unknown
  >;
  return (raw.root ?? raw) as unknown as LexicalNode;
}

/**
 * Read the current editor state as a proto Document.
 */
export function readEditorStateProto(editor: LexicalEditor): Document {
  return editorToDocument(editor);
}

/**
 * Build the payload that will be sent to the API.
 */
export function buildEditorPayload(editor: LexicalEditor): EditorPayload {
  const jsonRoot = readEditorStateJson(editor);
  return {
    namespace: editor._config?.namespace ?? "unknown",
    timestamp: new Date().toISOString(),
    state: JSON.stringify(jsonRoot, null, 2),
    proto: lexicalToDocument(jsonRoot),
  };
}

/**
 * Send editor state to the API.
 * Delegates to the Connect RPC bridge.
 */
export async function sendEditorState(
  editor: LexicalEditor,
  docId?: bigint,
): Promise<void> {
  const isEdit = typeof docId === "bigint" && docId > 0n;
  const id = isEdit
    ? await editEditor(editor, docId!)
    : await saveEditor(editor);

  console.group("%c📤 API sendEditorState", "color:#34d399;font-weight:600");
  console.log(isEdit ? "Edited" : "Saved", "with id:", id);
  console.groupEnd();
}

/**
 * Round-trip check: Lexical → proto → Lexical.
 * Useful for verifying the converter is lossless.
 */
export function verifyRoundTrip(editor: LexicalEditor): boolean {
  const original = readEditorStateJson(editor);
  const doc = lexicalToDocument(original);
  const restored = documentToLexical(doc);
  const ok = JSON.stringify(original) === JSON.stringify(restored);
  console.group(
    "%c🔄 Round-trip %s",
    "color:#fbbf24;font-weight:600",
    ok ? "✅ OK" : "❌ MISMATCH",
  );
  if (!ok) {
    console.log("Original:", original);
    console.log("Restored:", restored);
  }
  console.groupEnd();
  return ok;
}

/**
 * Debug listener: logs editor state on every update.
 */
export function logEditorState(editor: LexicalEditor): () => void {
  return editor.registerUpdateListener(({ editorState }) => {
    const json = editorState.toJSON();
    const doc = lexicalToDocument(json as unknown as { root: LexicalNode });
    console.group("%c📝 Lexical state", "color:#818cf8;font-weight:600");
    console.log("Proto:", doc);
    console.log("JSON:", json);
    console.groupEnd();
  });
}
