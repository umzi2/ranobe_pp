// ──────────────────────────────────────────────────────────
// Lexical  →  Connect RPC  bridge
// ──────────────────────────────────────────────────────────

import type { LexicalEditor } from "lexical";
import { toBinary } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
  DocumentSchema,
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

export type { Document };

// ──────────────────────────────────────────────────────────

const BACKEND = "http://localhost:8080";

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
  const doc = editorToDocument(editor);

  console.group("%c📤 Connect RPC saveEditor", "color:#34d399;font-weight:600");
  console.log("Document:", doc);
  console.log("Binary:", toBinary(DocumentSchema, doc));

  try {
    const res = await saveClient.save(doc);
    console.log("Response id:", res.id);
    console.groupEnd();
    return res.id;
  } catch (err) {
    console.error("Save failed:", err);
    console.groupEnd();
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
  console.group("%c☁️ Connect RPC getAwsUrl", "color:#60a5fa;font-weight:600");
  console.log("team:", teamId, "title:", titleId, "chapter:", chapterId);

  try {
    const res = await readClient.getAws({
      teamId,
      titleId,
      chapterId,
    });
    console.log("Response:", res);
    console.groupEnd();
    return res;
  } catch (err) {
    console.error("GetAws failed:", err);
    console.groupEnd();
    throw err;
  }
}
