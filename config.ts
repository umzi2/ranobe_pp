import { ParagraphNode, RootNode, TextNode, type CreateEditorArgs } from "lexical";

// import { EmojiNode } from "./plugins/emoji/node";

export const COMMENTS_EDITOR_CONFIG: CreateEditorArgs = {
  namespace: "CommentsEditor",
  onError: (e: Error) => console.error(e),
  nodes: [RootNode, ParagraphNode, TextNode],
  theme: {
    paragraph: "mb-1",
    text: {
        bold: 'lx-bold',
        italic: 'lx-italic',
        underline: 'lx-underline',
        strikethrough: 'lx-strike',
      },
  },
};