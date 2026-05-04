import { $getSelection, $isNodeSelection } from "lexical";
import { useEditor } from "~/molecules/EditorContext/EditorContext";
import { useRichTextPlugin } from "./plugins/useRichTextPlugin";
import { useDraggableBlockPlugin } from "./plugins/useDraggableBlock";
import { onMount, onCleanup } from "solid-js";
import { $isImageNode } from "./nodes/ImageNode";
import "./LexicalEditor.scss";

export function LexicalEditor() {
  const editor = useEditor();
  let editorRef: HTMLDivElement | undefined;

  const getEditorRef = () => editorRef;

  useRichTextPlugin(editor, getEditorRef);
  useDraggableBlockPlugin(editor, getEditorRef);

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
          const imgNode = sel.getNodes().find($isImageNode);
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
          }
        }
      });
    });
    onCleanup(unreg);
  });

  // Debug console
  onMount(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      const json = editorState.toJSON();
      console.group("%c📝 Lexical state", "color:#818cf8;font-weight:600");
      console.log(JSON.stringify(json, null, 2));
      console.groupEnd();
    });
    onCleanup(unregister);
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
