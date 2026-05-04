import { ParentProps } from "solid-js";
import "./EditorTemplate.scss";

/**
 * Template: centers the editor organism on the page (both axes).
 * Provides the drag-handle margin room on the left.
 */
export function EditorTemplate(props: ParentProps) {
  return <div class="editor-template">{props.children}</div>;
}
