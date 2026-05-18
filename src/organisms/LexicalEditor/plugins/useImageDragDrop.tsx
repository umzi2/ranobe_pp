import { onMount, onCleanup } from "solid-js";
import type { LexicalEditor } from "lexical";
import { $getRoot, $createParagraphNode } from "lexical";
import { uploadImageToCdn } from "./imageUploadPipeline";

export type { ImageDragDropParams } from "./imageUploadPipeline";

/**
 * SolidJS primitive that enables drag-and-drop image upload.
 *
 * When the user drops an image file onto the editor:
 * 1. Calls GetAws RPC to obtain a presigned PUT URL + page id
 * 2. Immediately inserts an ImageNode with the CDN URL
 * 3. In parallel, encodes the image to WebP and uploads via PUT
 */
export function useImageDragDrop(
  editor: LexicalEditor,
  editorElem: () => HTMLElement | undefined,
  params: () => { teamId: number; titleId: number; chapterId: number },
) {
  let dragCounter = 0;

  const onDragEnter = (_e: DragEvent) => {
    dragCounter++;
  };
  const onDragLeave = (_e: DragEvent) => {
    dragCounter--;
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragCounter = 0;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;

      console.group("%c🖼 Image drop", "color:#a78bfa;font-weight:600");
      console.log(
        "File:",
        file.name,
        file.type,
        `${(file.size / 1024).toFixed(1)}KB`,
      );

      // Non-blocking: node inserted immediately after GetAws, upload in background
      uploadImageToCdn(editor, file, params(), false /* append at end */);

      // Ensure trailing paragraph after drop
      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const last = children[children.length - 1];
        if (
          !last ||
          last.getType() !== "paragraph" ||
          (last as any).getTextContent?.() !== ""
        ) {
          const para = $createParagraphNode();
          root.append(para);
          para.select();
        }
      });

      console.groupEnd();
    }
  };

  onMount(() => {
    const el = editorElem();
    if (!el) return;

    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);

    onCleanup(() => {
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDrop);
    });
  });
}
