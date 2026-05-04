import {
  ParagraphNode,
  RootNode,
  TextNode,
  type CreateEditorArgs,
} from "lexical";
import { HeadingNode } from "@lexical/rich-text";
import { ImageNode } from "./src/organisms/LexicalEditor/nodes/ImageNode";
import { HorizontalRuleNode } from "./src/organisms/LexicalEditor/nodes/HorizontalRuleNode";

export const COMMENTS_EDITOR_CONFIG: CreateEditorArgs = {
  namespace: "CommentsEditor",
  onError: (e: Error) => console.error(e),
  nodes: [
    RootNode,
    ParagraphNode,
    TextNode,
    HeadingNode,
    ImageNode,
    HorizontalRuleNode,
  ],
  theme: {
    paragraph: "editor-paragraph",
    heading: {
      h1: "lx-h1",
      h2: "lx-h2",
      h3: "lx-h3",
    },
    text: {
      bold: "lx-bold",
      italic: "lx-italic",
      underline: "lx-underline",
      strikethrough: "lx-strike",
    },
  },
};
