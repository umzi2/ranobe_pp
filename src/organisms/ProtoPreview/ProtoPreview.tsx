/**
 * ProtoPreview — Solid-компонент под редактором.
 *
 * Два режима:
 *   1. Live — конвертирует текущий EditorState → proto → HTML (через viewer)
 *   2. API  — после Save фетчит Document по ID через сгенерированный RPC-клиент
 *
 * Сам viewer (viewer/render.ts) полностью независим и ничего не импортирует из ~/.
 * RPC-клиент (readClient) — сгенерированный, из основного кода.
 */

import { onMount, onCleanup, createSignal } from "solid-js";
import { useEditor } from "~/molecules/EditorContext/EditorContext";
import { lexicalToDocument } from "~/services/lexical-proto";
import { saveEditor, readClient } from "~/gen/lexical-rpc";
import { renderDocument, injectViewerStyles } from "../../../viewer/render";
import styles from "../ProtoPreview/ProtoPreview.module.scss";
import type { ViewerDocument } from "../../../viewer/types";

type PreviewMode = "live" | "api" | "idle";

export function ProtoPreview() {
  const editor = useEditor();
  let containerRef: HTMLDivElement | undefined;
  let idInputRef: HTMLInputElement | undefined;

  const [mode, setMode] = createSignal<PreviewMode>("idle");
  const [savedId, setSavedId] = createSignal<bigint | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  // Вставляем стили вьювера один раз
  onMount(() => {
    injectViewerStyles();
  });

  // ─── Утилита: proto Document → HTML через viewer ─────

  function renderProtoDoc(
    doc: Record<string, unknown>,
    container: HTMLDivElement,
  ) {
    // Приведение типов — структура proto Document идентична ViewerDocument
    container.innerHTML = renderDocument(doc as unknown as ViewerDocument);
  }

  // ─── Live preview ─────────────────────────────────────

  const renderLivePreview = () => {
    if (!containerRef) return;
    setError(null);

    const editorState = editor.getEditorState();
    const lexicalJson = editorState.toJSON();
    const protoDoc = lexicalToDocument(lexicalJson);

    renderProtoDoc(
      protoDoc as unknown as Record<string, unknown>,
      containerRef!,
    );
  };

  // ─── API preview через сгенерированный RPC-клиент ────

  const renderApiPreview = async (id: bigint) => {
    if (!containerRef) return;
    setLoading(true);
    setError(null);

    try {
      // readClient.read() — бинарный proto через Connect RPC
      const doc = await readClient.read({ id });
      renderProtoDoc(doc as unknown as Record<string, unknown>, containerRef!);
      setMode("api");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      containerRef!.innerHTML = `<div class="vv-root" style="color:#ef4444;">❌ ${msg}</div>`;
    } finally {
      setLoading(false);
    }
  };

  // ─── Save → RPC → Preview ────────────────────────────

  const handleSaveAndPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const id = await saveEditor(editor);
      setSavedId(id);
      await renderApiPreview(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadById = async () => {
    const raw = idInputRef?.value;
    if (!raw) return;
    const id = BigInt(raw);
    await renderApiPreview(id);
  };

  // ─── Live-слушатель (редактор → preview) ─────────────

  onMount(() => {
    const unreg = editor.registerUpdateListener(({ editorState }) => {
      // Live-режим работает только если нет активного API-режима
      if (mode() === "idle") {
        editorState.read(() => renderLivePreview());
      }
    });
    onCleanup(unreg);
  });

  const switchToLive = () => {
    setMode("idle");
    setSavedId(null);
    setError(null);
    renderLivePreview();
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div class={styles.previewPanel}>
      {/* Header */}
      <div class={styles.previewHeader}>
        <span class={styles.previewTitle}>
          📖 Preview
          {mode() === "api" && savedId()
            ? ` (API #${String(savedId())})`
            : mode() === "live"
              ? " (live)"
              : ""}
        </span>

        <div class={styles.previewActions}>
          <input
            ref={idInputRef}
            type="number"
            placeholder="Document ID…"
            class={styles.idInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoadById();
            }}
          />
          <button
            class={styles.actionBtn}
            onClick={handleLoadById}
            disabled={loading()}
          >
            Load
          </button>
        </div>
      </div>

      {/* Error */}
      {error() && <div class={styles.previewError}>{error()}</div>}

      {/* Content */}
      <div
        ref={containerRef}
        class={styles.previewContent}
        classList={{ [styles.previewLoading]: loading() }}
      />
    </div>
  );
}
