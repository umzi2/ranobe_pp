// ──────────────────────────────────────────────────────────
// Viewer RPC client — только чтение документов
//
// Подключается к бэкенду через Connect RPC (бинарный proto).
// ──────────────────────────────────────────────────────────

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { DocumentReadService, type Document } from "./gen/document_pb";

// ── Бэкенд ──────────────────────────────────────────────

const DEFAULT_BACKEND =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_BACKEND_URL) ||
  "http://localhost:8080";

function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("backend");
    if (fromQuery) return fromQuery;
  }
  return DEFAULT_BACKEND;
}

// ── Транспорт ───────────────────────────────────────────

let _transport: ReturnType<typeof createConnectTransport> | undefined;

function getTransport(): ReturnType<typeof createConnectTransport> {
  if (!_transport) {
    _transport = createConnectTransport({
      baseUrl: getBackendUrl(),
      useBinaryFormat: true,
    });
  }
  return _transport;
}

// ── Клиент ──────────────────────────────────────────────

export const readClient = createClient(DocumentReadService, getTransport());

// ── Методы ──────────────────────────────────────────────

/**
 * Загружает документ по ID.
 */
export async function loadDocument(id: bigint): Promise<Document> {
  console.log("[viewer] Loading document:", id);
  const doc = await readClient.read({ id });
  console.log("[viewer] Loaded:", doc);
  return doc;
}

export type { Document };
