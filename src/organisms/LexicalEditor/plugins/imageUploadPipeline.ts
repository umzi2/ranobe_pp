import type { LexicalEditor } from "lexical";
import {
  $getRoot,
  $getSelection,
  $getNodeByKey,
  $isRangeSelection,
  $createParagraphNode,
} from "lexical";
import { $createImageNode, ImageNode } from "../nodes/ImageNode";
import { getAwsUrl } from "~/gen/lexical-rpc";

const CDN_BASE = "https://cdn.animeai.site/r_pp";

export interface ImageDragDropParams {
  teamId: number;
  titleId: number;
  chapterId: number;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Convert a Blob to WebP via canvas. */
export function blobToWebP(blob: Blob, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const MAX_W = 1400;
      const MAX_H = 1600;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > MAX_W || h > MAX_H) {
        const ratio = Math.min(MAX_W / w, MAX_H / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return resolve(blob);
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob((b) => resolve(b ?? blob), "image/webp", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error("WebP conversion failed"));
    };
    img.src = u;
  });
}

/** PUT blob to presigned URL. */
export async function uploadToS3(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/webp" },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

/** Retry loading image from CDN with cache-buster. */
export async function retryImageLoad(
  editor: LexicalEditor,
  nodeKey: string,
  cdnSrc: string,
  maxRetries = 5,
  delayMs = 800,
) {
  for (let i = 1; i <= maxRetries; i++) {
    const busted = `${cdnSrc}?v=${Date.now()}`;
    console.log(`🔄 Retry ${i}/${maxRetries}`);
    editor.update(() => {
      const n = $getNodeByKey(nodeKey);
      if (n instanceof ImageNode) n.getWritable().__src = busted;
    });
    await new Promise((r) => setTimeout(r, delayMs));
    const imgEl = editor
      .getElementByKey(nodeKey)
      ?.querySelector<HTMLImageElement>("img");
    if (imgEl && imgEl.naturalWidth > 0) {
      editor.update(() => {
        const n = $getNodeByKey(nodeKey);
        if (n instanceof ImageNode) n.getWritable().__src = cdnSrc;
      });
      console.log(`✅ Image loaded (attempt ${i})`);
      return;
    }
  }
  console.warn("⚠ CDN image still not ready after retries");
}

// ──────────────────────────────────────────────────────────
// Public pipeline
// ──────────────────────────────────────────────────────────

/**
 * Full image upload pipeline:
 *   1. GetAws RPC → presigned PUT URL + page id
 *   2. Insert ImageNode with CDN URL (immediately, non-blocking)
 *   3. Background: WebP encode → PUT upload → retry CDN load
 *
 * @param editor       Lexical editor instance
 * @param blob         Image file/blob from drag-drop or clipboard
 * @param params       team/title/chapter ids
 * @param atSelection  If true, insert at current cursor; otherwise append to end
 */
export async function uploadImageToCdn(
  editor: LexicalEditor,
  blob: Blob,
  params: ImageDragDropParams,
  atSelection: boolean,
): Promise<void> {
  const { teamId, titleId, chapterId } = params;

  // 1. Get presigned URL
  const { url, id: pageId } = await getAwsUrl(teamId, titleId, chapterId);

  // 2. Build CDN URL
  const cdnSrc = `${CDN_BASE}/${teamId}/${titleId}/${chapterId}/${pageId}.webp`;

  // 3. Insert ImageNode synchronously
  let nodeKey: string | null = null;
  editor.update(() => {
    const img = $createImageNode(cdnSrc);
    nodeKey = img.__key;
    const para = $createParagraphNode();

    const sel = $getSelection();
    if (atSelection && $isRangeSelection(sel)) {
      sel.insertNodes([img, para]);
    } else {
      const root = $getRoot();
      const last = root.getLastChild();
      if (last) last.insertAfter(img);
      else root.append(img);
      img.insertAfter(para);
      para.select();
    }
  });

  // 4. Fire-and-forget: encode → upload → retry (never blocks the editor)
  (async () => {
    try {
      const webp = await blobToWebP(blob, 0.85);
      console.log(
        `WebP: ${(webp.size / 1024).toFixed(1)}KB (${((webp.size / blob.size) * 100).toFixed(0)}%)`,
      );
      await uploadToS3(url, webp);
      console.log("✅ Upload complete");
      if (nodeKey) retryImageLoad(editor, nodeKey, cdnSrc);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  })();
}
