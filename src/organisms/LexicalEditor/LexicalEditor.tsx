import { $getSelection, $isNodeSelection } from "lexical";
import { useEditor } from "~/molecules/EditorContext/EditorContext";
import { useRichTextPlugin } from "./plugins/useRichTextPlugin";
import { useQuoteEnter } from "./plugins/useQuoteEnter";
import { useDraggableBlockPlugin } from "./plugins/useDraggableBlock";
import { useImageDragDrop } from "./plugins/useImageDragDrop";
import { useImagePaste } from "./plugins/useImagePaste";
import type { ImageDragDropParams } from "./plugins/imageUploadPipeline";
import { onMount, onCleanup } from "solid-js";
import { $isImageNode } from "./nodes/ImageNode";
import { $isHorizontalRuleNode } from "./nodes/HorizontalRuleNode";
import { useLocalStoragePersistence } from "./plugins/useLocalStoragePersistence";
import { logEditorState } from "~/services/api";
import "./LexicalEditor.scss";

export interface LexicalEditorProps {
  chapterParams?: ImageDragDropParams;
  /** Вызывается при Ctrl+S */
  onSave?: () => void;
}

export function LexicalEditor(props: LexicalEditorProps) {
  const editor = useEditor();
  let editorRef: HTMLDivElement | undefined;

  const getEditorRef = () => editorRef;

  useRichTextPlugin(editor, getEditorRef);
  useQuoteEnter(editor);
  useDraggableBlockPlugin(editor, getEditorRef);

  // Image upload: drag-and-drop + clipboard paste
  if (props.chapterParams) {
    useImageDragDrop(editor, getEditorRef, () => props.chapterParams!);
    useImagePaste(editor, getEditorRef, () => props.chapterParams!);
  }

  // Image selection → toggle .lx-image-selected class on the <figure>
  onMount(() => {
    const unreg = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const sel = $getSelection();

        // Remove selected class from all figures
        editorRef?.querySelectorAll(".lx-image-selected").forEach((el) => {
          el.classList.remove("lx-image-selected");
        });

        if ($isNodeSelection(sel)) {
          const nodes = sel.getNodes();
          const imgNode = nodes.find($isImageNode);
          const hrNode = nodes.find($isHorizontalRuleNode);
          if (imgNode) {
            // Find the corresponding figure by traversing the editor DOM
            const figures =
              editorRef?.querySelectorAll("figure.lx-image-wrapper") ?? [];
            for (const fig of figures) {
              const img = fig.querySelector("img");
              // Compare with naturalWidth as a sanity check — the key is the only stable ref
              // but we don't have it in the DOM. Use src match.
              if (img) {
                // src from the node and src from DOM — normalise by checking endsWith
                // because the DOM resolves relative URLs
                const nodeSrc = imgNode.__src;
                const domSrc = img.getAttribute("src") ?? "";
                if (
                  domSrc === nodeSrc ||
                  domSrc.endsWith(nodeSrc) ||
                  nodeSrc.endsWith(domSrc)
                ) {
                  fig.classList.add("lx-image-selected");
                  break;
                }
              }
            }
          } else if (hrNode) {
            // Handle HR selection — find wrapper by node key
            const wrappers =
              editorRef?.querySelectorAll(".lx-hr-wrapper") ?? [];
            for (const w of wrappers) {
              if (
                w instanceof HTMLElement &&
                w.getAttribute("data-key") === hrNode.__key
              ) {
                w.classList.add("lx-image-selected");
                break;
              }
            }
          }
        }
      });
    });
    onCleanup(unreg);
  });

  // Persist editor state to localStorage
  const storageKey = props.chapterParams
    ? `${props.chapterParams.teamId}-${props.chapterParams.titleId}-${props.chapterParams.chapterId}`
    : "draft";
  useLocalStoragePersistence(editor, storageKey);

  // Ctrl+S → onSave
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        props.onSave?.();
      }
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  // Debug: log editor state on every update (dev only)
  onMount(() => {
    if (import.meta.env.DEV) {
      const unregister = logEditorState(editor);
      onCleanup(unregister);
    }
  });

  return (
    <div class="Lexica">
      <div
        ref={(el) => (editorRef = el)}
        contentEditable={true}
        spellcheck={false}
        class="Lexica_editor"
        data-placeholder="Start writing…"
      />
    </div>
  );
}
