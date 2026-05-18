import { onMount, onCleanup } from "solid-js";
import type { LexicalEditor } from "lexical";
import {
  $getRoot,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $insertNodes,
  COMMAND_PRIORITY_CRITICAL,
  PASTE_COMMAND,
} from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";
import { $createImageNode, ImageNode } from "../nodes/ImageNode";
import { blobToWebP, uploadToS3, retryImageLoad } from "./imageUploadPipeline";
import { getAwsUrl } from "~/gen/lexical-rpc";
import type { ImageDragDropParams } from "./imageUploadPipeline";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function dataUriToBlob(d: string): Blob | null {
  // Match data:image/xxx;base64,... OR data:;base64,...
  const m = d.match(/^data:[^;]*;base64,(.+)$/);
  if (!m) return null;
  try {
    const r = atob(m[1]);
    const b = new Uint8Array(r.length);
    for (let i = 0; i < r.length; i++) b[i] = r.charCodeAt(i);
    return new Blob([b], { type: "image/png" });
  } catch {
    return null;
  }
}

function parseGoogleImageMap(raw: string): Map<string, string> | null {
  try {
    const o = JSON.parse(raw);
    const i = JSON.parse(o.data);
    const u = i.image_urls as Record<string, string>;
    return u ? new Map(Object.entries(u)) : null;
  } catch {
    return null;
  }
}

function parseGoogleDocSlice(raw: string): {
  spacers: string;
  entityMap: Record<string, any>;
  entityPositionMap: Array<null | [string]>;
} | null {
  try {
    const o = JSON.parse(raw);
    const i = JSON.parse(o.data);
    const r = i.resolved;
    if (
      r?.dsl_spacers &&
      r?.dsl_entitymap &&
      r?.dsl_entitypositionmap?.inline
    ) {
      return {
        spacers: r.dsl_spacers as string,
        entityMap: r.dsl_entitymap as Record<string, any>,
        entityPositionMap: r.dsl_entitypositionmap.inline as Array<
          null | [string]
        >,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchBlob(u: string) {
  try {
    const r = await fetch(u);
    return r.ok ? await r.blob() : null;
  } catch {
    return null;
  }
}

function findImg(
  root: ReturnType<typeof $getRoot>,
  src: string,
): string | null {
  function w(n: any): string | null {
    if (n instanceof ImageNode && n.__src === src) return n.__key;
    if ("getChildren" in n)
      for (const c of n.getChildren()) {
        const k = w(c);
        if (k) return k;
      }
    return null;
  }
  return w(root);
}

// ──────────────────────────────────────────────────────────
// Google Docs: inject <img> tags into original HTML DOM
// ──────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function injectImagesIntoHtml(
  originalHtml: string,
  spacers: string,
  ep: Array<null | [string]>,
  em: Record<string, any>,
  imageUrls: Map<string, string>,
): Document {
  // 1. Build map: spacers character index → { blobId, url }
  const imageAt: Map<number, { blobId: string; url: string }> = new Map();
  for (let i = 0; i < ep.length; i++) {
    const entry = ep[i];
    if (entry !== null) {
      const entityKey = entry[0];
      const blobId = em[entityKey]?.ee_eo?.i_cid;
      if (blobId && imageUrls.has(blobId)) {
        imageAt.set(i, { blobId, url: imageUrls.get(blobId)! });
      }
    }
  }

  // 2. Split spacers into paragraphs, tracking which contain images
  const spacersParas = spacers.split("\n");
  const imageBySpacerPara: Map<number, { blobId: string; url: string }> =
    new Map();
  let absOffset = 0;
  for (let pi = 0; pi < spacersParas.length; pi++) {
    const para = spacersParas[pi];
    for (let ci = 0; ci < para.length; ci++) {
      const absIdx = absOffset + ci;
      const img = imageAt.get(absIdx);
      if (img && para[ci] === "*") imageBySpacerPara.set(pi, img);
    }
    absOffset += para.length + 1;
  }

  // 3. Parse original HTML to get block-level elements
  const doc = new DOMParser().parseFromString(originalHtml, "text/html");
  const body = doc.body;

  const htmlBlocks: Element[] = [];
  for (const child of body.childNodes) {
    if (child instanceof Element) {
      const tag = child.tagName.toLowerCase();
      if (
        tag === "p" ||
        tag === "h1" ||
        tag === "h2" ||
        tag === "h3" ||
        tag === "h4" ||
        tag === "h5" ||
        tag === "h6" ||
        tag === "div" ||
        tag === "li" ||
        tag === "br"
      ) {
        htmlBlocks.push(child);
      } else if (tag !== "meta") {
        htmlBlocks.push(child);
      }
    }
  }

  // 4. Walk both arrays in parallel, aligning by text similarity
  const replacements: Map<Element, { blobId: string; url: string }> = new Map();
  let si = 0,
    hi = 0;

  while (si < spacersParas.length && hi < htmlBlocks.length) {
    const sp = spacersParas[si];
    const hb = htmlBlocks[hi];
    const hbTag = hb.tagName.toLowerCase();
    const hbText = norm((hb as HTMLElement).textContent ?? "");

    const img = imageBySpacerPara.get(si);
    if (img) {
      if (
        hbTag === "p" &&
        (hbText === "" || hbText === "*" || hbText === "**")
      ) {
        replacements.set(hb, img);
        si++;
        hi++;
        continue;
      }
      // Search forward for the next placeholder
      let found = false;
      for (let fwd = hi; fwd < htmlBlocks.length && !found; fwd++) {
        const fb = htmlBlocks[fwd];
        const fbTag = fb.tagName.toLowerCase();
        const fbText = norm((fb as HTMLElement).textContent ?? "");
        if (
          fbTag === "p" &&
          (fbText === "" || fbText === "*" || fbText === "**")
        ) {
          replacements.set(fb, img);
          hi = fwd + 1;
          si++;
          found = true;
        }
      }
      if (!found) {
        si++;
        hi++;
      }
      continue;
    }

    const spNorm = norm(sp.replace(/\*/g, "").replace(/\x0b/g, " "));

    if (hbTag === "br") {
      if (spNorm === "") {
        si++;
        hi++;
      } else {
        hi++;
      }
      continue;
    }

    if (spNorm === hbText) {
      si++;
      hi++;
    } else if (
      spNorm &&
      hbText &&
      (spNorm.includes(hbText) || hbText.includes(spNorm))
    ) {
      si++;
      hi++;
    } else if (spNorm === "" && hbText !== "") {
      si++;
    } else if (spNorm !== "" && hbText === "") {
      hi++;
    } else {
      si++;
      hi++;
    }
  }

  // 5. Replace marked elements with <img>
  for (const [el, { url }] of replacements) {
    const img = doc.createElement("img");
    img.setAttribute("src", url);
    img.setAttribute("alt", "");
    el.replaceWith(img);
  }

  return doc;
}

// ──────────────────────────────────────────────────────────
// Plugin
// ──────────────────────────────────────────────────────────

export function useImagePaste(
  editor: LexicalEditor,
  _: any,
  params: () => ImageDragDropParams,
) {
  onMount(() => {
    const unreg = editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const cd = event.clipboardData;
        if (!cd) return false;

        const htm = cd.getData("text/html");
        const hasG =
          cd.getData("application/x-vnd.google-docs-image-clip+wrapped") !== "";

        if (
          !hasG &&
          !htm.includes("<img") &&
          cd.files.length === 0 &&
          !Array.from(cd.items).some((it) => it.type.startsWith("image/"))
        )
          return false;

        event.preventDefault();
        event.stopImmediatePropagation();

        const p = params();

        const fb: Blob[] = [];
        const seenKeys = new Set<string>();
        const addFile = (f: File | null) => {
          if (!f || !f.type.startsWith("image/")) return;
          const key = `${f.name}:${f.size}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            fb.push(f);
          }
        };
        for (let i = 0; i < cd.files.length; i++) addFile(cd.files.item(i));
        let pt = "";
        for (let i = 0; i < cd.items.length; i++) {
          const it = cd.items[i];
          if (it.type === "text/plain")
            it.getAsString((s: string) => {
              if (s) pt = s;
            });
          if (it.type.startsWith("image/")) addFile(it.getAsFile());
        }

        const icr = cd.getData(
          "application/x-vnd.google-docs-image-clip+wrapped",
        );
        const dsr = cd.getData(
          "application/x-vnd.google-docs-document-slice-clip+wrapped",
        );

        (async () => {
          let didInsertImages = false;

          // ── 1. Google Docs paste ──
          if (hasG && icr && dsr && htm) {
            const imageUrls = parseGoogleImageMap(icr);
            const docSlice = parseGoogleDocSlice(dsr);

            if (imageUrls && docSlice && imageUrls.size > 0) {
              const { spacers, entityMap, entityPositionMap: ep } = docSlice;

              const modifiedDoc = injectImagesIntoHtml(
                htm,
                spacers,
                ep,
                entityMap,
                imageUrls,
              );

              editor.update(() => {
                const ns = $generateNodesFromDOM(editor, modifiedDoc);
                const s = $getSelection();
                if ($isRangeSelection(s)) s.insertNodes(ns);
                else $insertNodes(ns);
              });
              didInsertImages = true;

              // Background: upload Google Docs images to CDN
              for (const [blobId, googleUrl] of imageUrls) {
                uploadToCdn(editor, googleUrl, p);
              }

              // Ensure trailing paragraph after Google Docs paste
              editor.update(() => {
                ensureTrailingParagraph();
              });
            }
          }

          // ── 2. Regular HTML paste (skip if Google Docs already handled) ──
          if (!didInsertImages && htm) {
            const doc = new DOMParser().parseFromString(htm, "text/html");
            let hasImgTag = false;

            for (const img of doc.querySelectorAll("img")) {
              hasImgTag = true;
              const src = img.getAttribute("src") ?? "";

              if (src.startsWith("data:")) {
                const b = dataUriToBlob(src);
                if (b) {
                  const u = URL.createObjectURL(b);
                  img.setAttribute("src", u);
                }
              }
            }

            editor.update(() => {
              const ns = $generateNodesFromDOM(editor, doc);
              const s = $getSelection();
              if ($isRangeSelection(s)) s.insertNodes(ns);
              else $insertNodes(ns);
            });
            if (hasImgTag) didInsertImages = true;
          } else if (!didInsertImages && pt) {
            editor.update(() => {
              const s = $getSelection();
              if ($isRangeSelection(s)) s.insertNodes([$createTextNode(pt)]);
            });
          }

          // ── 3. File/image items ──
          if (!didInsertImages && fb.length > 0) {
            for (const b of fb) {
              upFile(editor, b, p);
            }
            didInsertImages = true;
          }

          // ── 4. Ensure trailing paragraph ──
          editor.update(() => {
            ensureTrailingParagraph();
          });

          // ── 5. Final sweep: runs unconditionally to catch any stragglers ──
          setTimeout(() => sweepAndUploadImages(editor, p), 200);
        })();
        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
    onCleanup(unreg);
  });
}

// ──────────────────────────────────────────────────────────
// Ensure there's always an empty paragraph at the end
// ──────────────────────────────────────────────────────────

function ensureTrailingParagraph() {
  const root = $getRoot();
  const children = root.getChildren();
  const last = children[children.length - 1];

  // If the last child is not an empty paragraph, add one
  if (
    !last ||
    last.getType() !== "paragraph" ||
    (last as any).getTextContent?.() !== ""
  ) {
    const para = $createParagraphNode();
    root.append(para);
    para.select();
  }
}

// ──────────────────────────────────────────────────────────
// Deduplicate: remove ImageNodes with duplicate __src
// ──────────────────────────────────────────────────────────

function removeDuplicateImages() {
  const seen = new Map<string, string>();
  const toRemove: string[] = [];

  function walk(n: any) {
    if (n instanceof ImageNode) {
      const src = n.__src;
      if (src) {
        if (seen.has(src)) {
          toRemove.push(n.__key);
        } else {
          seen.set(src, n.__key);
        }
      }
    }
    if ("getChildren" in n) for (const c of n.getChildren()) walk(c);
  }
  walk($getRoot());

  for (const key of toRemove) {
    const n = $getNodeByKey(key);
    if (n) {
      const next = n.getNextSibling();
      if (
        next &&
        next.getType() === "paragraph" &&
        (next as any).getTextContent?.() === ""
      ) {
        next.remove();
      }
      n.remove();
    }
  }

  if (toRemove.length > 0) {
    console.log(`🗑 Removed ${toRemove.length} duplicate image(s)`);
  }
}

// ──────────────────────────────────────────────────────────
// Unified sweep: find all ImageNodes with non-CDN src
// ──────────────────────────────────────────────────────────

function sweepAndUploadImages(editor: LexicalEditor, p: ImageDragDropParams) {
  const nonCdn: Array<{ key: string; src: string }> = [];
  editor.getEditorState().read(() => {
    function walk(n: any) {
      if (n instanceof ImageNode) {
        const src = n.__src;
        if (
          src &&
          !src.startsWith("https://cdn.animeai.site/") &&
          !src.startsWith("blob:")
        ) {
          nonCdn.push({ key: n.__key, src });
        }
      }
      if ("getChildren" in n) for (const c of n.getChildren()) walk(c);
    }
    walk($getRoot());
  });

  if (nonCdn.length === 0) {
    // No non-CDN images, but still check for duplicates
    editor.update(() => {
      removeDuplicateImages();
    });
    return;
  }
  console.log(
    `🧹 Sweep: found ${nonCdn.length} non-CDN image(s) to upload`,
    nonCdn.map((n) => n.src.slice(0, 60)),
  );

  // Deduplicate: if multiple ImageNodes have the same src, keep only the first
  editor.update(() => {
    removeDuplicateImages();
  });

  for (const { key, src } of nonCdn) {
    (async () => {
      try {
        let blob: Blob | null = null;

        if (src.startsWith("data:")) {
          blob = dataUriToBlob(src);
          if (!blob) {
            console.warn("Sweep: failed to decode base64");
            return;
          }
        } else {
          blob = await fetchBlob(src);
          if (!blob) {
            console.warn("Sweep: failed to fetch URL:", src.slice(0, 80));
            return;
          }
        }

        const { teamId: ti, titleId: tti, chapterId: ci } = p;
        const { url: pu, id: pi } = await getAwsUrl(ti, tti, ci);
        const cdn = `https://cdn.animeai.site/r_pp/${ti}/${tti}/${ci}/${pi}.webp`;

        let nk: string | null = null;
        editor.update(() => {
          const n = $getNodeByKey(key);
          if (n instanceof ImageNode) {
            n.getWritable().__src = cdn;
            nk = key;
          }
        });

        const webp = await blobToWebP(blob, 0.85);
        console.log(
          `WebP: ${(webp.size / 1024).toFixed(1)}KB (${((webp.size / blob.size) * 100).toFixed(0)}%)`,
        );
        await uploadToS3(pu, webp);
        if (nk) await retryImageLoad(editor, nk, cdn);
        console.log("✅ Sweep upload complete");
      } catch (err) {
        console.error("Sweep upload failed:", err);
      }
    })();
  }
}

// ──────────────────────────────────────────────────────────
// Upload helpers
// ──────────────────────────────────────────────────────────

async function uploadToCdn(
  editor: LexicalEditor,
  url: string,
  p: ImageDragDropParams,
) {
  try {
    const { teamId: ti, titleId: tti, chapterId: ci } = p;
    const { url: pu, id: pi } = await getAwsUrl(ti, tti, ci);
    const cdn = `https://cdn.animeai.site/r_pp/${ti}/${tti}/${ci}/${pi}.webp`;

    let nk: string | null = null;
    editor.update(() => {
      nk = findImg($getRoot(), url);
      if (nk) {
        const n = $getNodeByKey(nk);
        if (n instanceof ImageNode) n.getWritable().__src = cdn;
      }
    });

    const blob = await fetchBlob(url);
    if (blob) {
      await uploadToS3(pu, await blobToWebP(blob, 0.85));
      if (nk) await retryImageLoad(editor, nk, cdn);
    }
  } catch (err) {
    console.error("Upload failed:", err);
  }
}

async function upFile(e: LexicalEditor, b: Blob, p: ImageDragDropParams) {
  try {
    const { teamId: ti, titleId: tti, chapterId: ci } = p;
    const { url: pu, id: pi } = await getAwsUrl(ti, tti, ci);
    const c = `https://cdn.animeai.site/r_pp/${ti}/${tti}/${ci}/${pi}.webp`;
    let nk: string | null = null;
    e.update(() => {
      const img = $createImageNode(c);
      nk = img.__key;
      const pa = $createParagraphNode();
      const s = $getSelection();
      if ($isRangeSelection(s)) s.insertNodes([img, pa]);
      else {
        const r = $getRoot();
        const l = r.getLastChild();
        if (l) l.insertAfter(img);
        else r.append(img);
        img.insertAfter(pa);
        pa.select();
      }
    });
    await uploadToS3(pu, await blobToWebP(b, 0.85));
    if (nk) await retryImageLoad(e, nk, c);
  } catch (err) {
    console.error("Upload failed:", err);
  }
}
