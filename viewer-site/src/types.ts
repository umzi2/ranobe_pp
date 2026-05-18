/**
 * ──────────────────────────────────────────────────────────
 * Viewer types – зеркало proto типов без единого импорта.
 *
 * Никаких зависимостей от @bufbuild/protobuf, lexical, solid и т.д.
 * Простые интерфейсы, которые можно скормить рендереру.
 * ──────────────────────────────────────────────────────────
 */

/* ────────── enums (числовые, как в proto) ────────── */
export const enum NodeType {
  UNSPECIFIED = 0,
  ROOT = 1,
  PARAGRAPH = 2,
  TEXT = 3,
  HEADING = 4,
  IMAGE = 5,
  HORIZONTAL_RULE = 6,
  QUOTE = 7,
  CODE = 8,
  LIST = 9,
  LIST_ITEM = 10,
  LINK = 11,
  LINE_BREAK = 12,
  COMMENT = 13,
}

export const enum HeadingTag {
  UNSPECIFIED = 0,
  H1 = 1,
  H2 = 2,
  H3 = 3,
  H4 = 4,
  H5 = 5,
  H6 = 6,
}

export const enum Alignment {
  INHERIT = 0,
  LEFT = 1,
  CENTER = 2,
  RIGHT = 3,
  JUSTIFY = 4,
}

/* ────────── data-структуры ────────── */
export interface ViewerTextData {
  text: string;
  format: number;
  detail: number;
  mode: string;
  style: string;
}

export interface ViewerImageData {
  src: string;
  alt: string;
  alignment: Alignment;
  width: number;
  widthType: string;
}

export interface ViewerHeadingData {
  tag: HeadingTag;
}

export interface ViewerListData {
  ordered: boolean;
  start: number;
  listType: string;
}

export interface ViewerLinkData {
  url: string;
  rel: string;
  target: string;
  title: string;
}

export interface ViewerCommentData {
  commentText: string;
}

/** Одна из data-секций узла */
export type ViewerNodeData =
  | { case: "text"; value: ViewerTextData }
  | { case: "image"; value: ViewerImageData }
  | { case: "heading"; value: ViewerHeadingData }
  | { case: "list"; value: ViewerListData }
  | { case: "link"; value: ViewerLinkData }
  | { case: "comment"; value: ViewerCommentData }
  | { case: undefined; value?: undefined };

/* ────────── Node ────────── */
export interface ViewerNode {
  type: NodeType;
  version: number;
  attrs: Record<string, string>;
  children: ViewerNode[];
  data: ViewerNodeData;
}

/* ────────── Document ────────── */
export interface ViewerDocument {
  version: string;
  meta: Record<string, string>;
  root?: ViewerNode;
}
