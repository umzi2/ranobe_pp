// ──────────────────────────────────────────────────────────
// Lexical  →  Connect RPC  bridge
// ──────────────────────────────────────────────────────────

import type { LexicalEditor } from "lexical";
import { create, toBinary } from "@bufbuild/protobuf";
import { createClient, ConnectError, Code } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
  DocumentSchema,
  CreateDocumetnRequestSchema,
  EditDocumentRequestSchema,
  DocumentSaveService,
  DocumentReadService,
  type Document,
  type AWSPutResponse,
} from "./document_pb";
import {
  lexicalToDocument,
  documentToLexical,
  type LexicalNode,
} from "~/services/lexical-proto";
import { resolveApiKey, clearStoredApiKey } from "~/services/api-key";

export type { Document };

// ──────────────────────────────────────────────────────────

const BACKEND =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_BACKEND_URL) ||
  "http://localhost:8080";

let _transport: ReturnType<typeof createConnectTransport> | undefined;

function getTransport() {
  if (!_transport) {
    _transport = createConnectTransport({
      baseUrl: BACKEND,
      useBinaryFormat: true,
    });
  }
  return _transport;
}

export const saveClient = createClient(DocumentSaveService, getTransport());
export const readClient = createClient(DocumentReadService, getTransport());

// ──────────────────────────────────────────────────────────

export function editorToDocument(editor: LexicalEditor): Document {
  const raw = editor.getEditorState().toJSON();
  return lexicalToDocument(raw as unknown as { root: LexicalNode });
}

export async function saveEditor(editor: LexicalEditor): Promise<bigint> {
  const apiKey = await resolveApiKey();
  const doc = editorToDocument(editor);

  console.group("%c📤 Connect RPC saveEditor", "color:#34d399;font-weight:600");
  console.log("Document:", doc);
  console.log("Binary:", toBinary(DocumentSchema, doc));

  try {
    const req = create(CreateDocumetnRequestSchema, {
      apiKey,
      document: doc,
    });
    const res = await saveClient.save(req);
    console.log("Response id:", res.id);
    console.groupEnd();
    return res.id;
  } catch (err) {
    console.error("Save failed:", err);
    console.groupEnd();
    if (isAuthError(err)) {
      clearStoredApiKey();
    }
    throw err;
  }
}

export async function editEditor(
  editor: LexicalEditor,
  id: bigint,
): Promise<bigint> {
  const apiKey = await resolveApiKey();
  const doc = editorToDocument(editor);

  console.group("%c📝 Connect RPC editEditor", "color:#f59e0b;font-weight:600");
  console.log("id:", id, "Document:", doc);
  console.log("Binary:", toBinary(DocumentSchema, doc));

  try {
    console.log("[editEditor] saveClient.edit:", typeof saveClient.edit);
    const editReq = create(EditDocumentRequestSchema, {
      id,
      document: doc,
      apiKey,
    });
    console.log("[editEditor] editReq:", editReq);
    const res = await saveClient.edit(editReq);
    console.log("Response id:", res.id);
    console.groupEnd();
    return res.id;
  } catch (err) {
    console.error("Edit failed:", err);
    console.groupEnd();
    if (isAuthError(err)) {
      clearStoredApiKey();
    }
    throw err;
  }
}

export async function loadDocument(id: bigint): Promise<LexicalNode> {
  console.group(
    "%c📥 Connect RPC loadDocument",
    "color:#60a5fa;font-weight:600",
  );
  console.log("Request id:", id);
  console.groupEnd();

  const doc = await readClient.read({ id });
  return { root: documentToLexical(doc) } as unknown as LexicalNode;
}

/**
 * Get a presigned PUT URL for image upload.
 * Returns the upload URL and a unique page id.
 */
export async function getAwsUrl(
  teamId: number,
  titleId: number,
  chapterId: number,
): Promise<AWSPutResponse> {
  const apiKey = await resolveApiKey();

  console.group("%c☁️ Connect RPC getAwsUrl", "color:#60a5fa;font-weight:600");
  console.log("team:", teamId, "title:", titleId, "chapter:", chapterId);

  try {
    const res = await readClient.getAws({
      teamId,
      titleId,
      chapterId,
      apiKey,
    });
    console.log("Response:", res);
    console.groupEnd();
    return res;
  } catch (err) {
    console.error("GetAws failed:", err);
    console.groupEnd();
    if (isAuthError(err)) {
      clearStoredApiKey();
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/**
 * Returns true if the error indicates an authentication/authorization
 * problem (e.g. invalid or missing API key).
 */
function isAuthError(err: unknown): boolean {
  if (err instanceof ConnectError) {
    return (
      err.code === Code.Unauthenticated || err.code === Code.PermissionDenied
    );
  }
  return false;
}
