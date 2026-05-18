// ──────────────────────────────────────────────────────────
// Lexical JSON  ←→  generated Proto  converter
//
// Uses the types from `src/gen/document_pb.ts` (protoc-gen-es v2).
// ──────────────────────────────────────────────────────────

import { create } from "@bufbuild/protobuf";
import {
  NodeType,
  HeadingTag,
  Alignment,
  DocumentSchema,
  NodeSchema,
  TextDataSchema,
  ImageDataSchema,
  HeadingDataSchema,
  ListDataSchema,
  LinkDataSchema,
  type Document,
  type Node,
} from "~/gen/document_pb";

// ---- Lexical JSON shape (subset we walk) ----
export interface LexicalNode {
  type: string;
  version: number;
  [key: string]: unknown;
  children?: LexicalNode[];
}

// ──────────────────────────────────────────────────────────
// Lookup tables
// ──────────────────────────────────────────────────────────

const LEXICAL_TYPE_TO_PROTO: Record<string, NodeType> = {
  root: NodeType.NODE_ROOT,
  paragraph: NodeType.NODE_PARAGRAPH,
  text: NodeType.NODE_TEXT,
  heading: NodeType.NODE_HEADING,
  image: NodeType.NODE_IMAGE,
  horizontalrule: NodeType.NODE_HORIZONTAL_RULE,
  quote: NodeType.NODE_QUOTE,
  code: NodeType.NODE_CODE,
  list: NodeType.NODE_LIST,
  listitem: NodeType.NODE_LIST_ITEM,
  link: NodeType.NODE_LINK,
  linebreak: NodeType.NODE_LINE_BREAK,
};

const PROTO_TO_LEXICAL_TYPE: Record<number, string> = {};
for (const [k, v] of Object.entries(LEXICAL_TYPE_TO_PROTO)) {
  PROTO_TO_LEXICAL_TYPE[v] = k;
}

const ALIGN_TO_PROTO: Record<string, Alignment> = {
  "": Alignment.ALIGN_INHERIT,
  left: Alignment.ALIGN_LEFT,
  center: Alignment.ALIGN_CENTER,
  right: Alignment.ALIGN_RIGHT,
  justify: Alignment.ALIGN_JUSTIFY,
};

const PROTO_TO_ALIGN: Record<number, string> = {
  [Alignment.ALIGN_INHERIT]: "",
  [Alignment.ALIGN_LEFT]: "left",
  [Alignment.ALIGN_CENTER]: "center",
  [Alignment.ALIGN_RIGHT]: "right",
  [Alignment.ALIGN_JUSTIFY]: "justify",
};

const TAG_TO_PROTO: Record<string, HeadingTag> = {
  h1: HeadingTag.HEADING_H1,
  h2: HeadingTag.HEADING_H2,
  h3: HeadingTag.HEADING_H3,
  h4: HeadingTag.HEADING_H4,
  h5: HeadingTag.HEADING_H5,
  h6: HeadingTag.HEADING_H6,
};

const PROTO_TO_TAG: Record<number, string> = {};
for (const [k, v] of Object.entries(TAG_TO_PROTO)) {
  PROTO_TO_TAG[v] = k;
}

// Keys that go to attrs for block nodes (paragraph, heading, root, quote, code)
// but NOT for text nodes (text has its own format field)
const BLOCK_ATTR_KEYS = new Set([
  "direction",
  "indent",
  "textFormat", // block-level text-format bitfield
  "textStyle",
]);
// "format" is special:
//   block nodes → alignment string (left/center/right/justify) → attrs
//   text nodes  → format bitfield (bold/italic/...) → data.text.format

// ──────────────────────────────────────────────────────────
// Serialise: Lexical JSON tree  →  proto Document
// ──────────────────────────────────────────────────────────

export function lexicalToDocument(
  lexicalJson: LexicalNode | { root: LexicalNode },
): Document {
  // Lexical's toJSON() wraps the root in { root: ... }
  const rootNode =
    "root" in lexicalJson && lexicalJson.root != null
      ? (lexicalJson.root as LexicalNode)
      : (lexicalJson as LexicalNode);
  return create(DocumentSchema, {
    version: "1",
    meta: {},
    root: convertNode(rootNode),
  });
}

function convertNode(lex: LexicalNode): Node {
  const type: NodeType =
    LEXICAL_TYPE_TO_PROTO[lex.type] ?? NodeType.NODE_UNSPECIFIED;

  const attrs: Record<string, string> = {};
  const rest: Record<string, unknown> = {};

  const isText = lex.type === "text";
  for (const [key, val] of Object.entries(lex)) {
    if (key === "type" || key === "version" || key === "children") continue;
    // "format" means different things for different node types
    if (key === "format") {
      if (isText) {
        rest[key] = val; // inline format bitfield → data.text.format
      } else {
        attrs[key] = val == null ? "" : String(val); // alignment → attrs
      }
    } else if (BLOCK_ATTR_KEYS.has(key)) {
      attrs[key] = val == null ? "" : String(val);
    } else {
      rest[key] = val;
    }
  }

  const base: Node = create(NodeSchema, {
    type,
    version: lex.version ?? 1,
    attrs,
    children: (lex.children ?? []).map(convertNode),
  });

  switch (type) {
    case NodeType.NODE_TEXT:
      base.data = {
        case: "text",
        value: create(TextDataSchema, {
          text: String(rest.text ?? ""),
          format: Number(rest.format ?? 0),
          detail: Number(rest.detail ?? 0),
          mode: String(rest.mode ?? "normal"),
          style: String(rest.style ?? ""),
        }),
      };
      break;
    case NodeType.NODE_IMAGE:
      base.data = {
        case: "image",
        value: create(ImageDataSchema, {
          src: String(rest.src ?? ""),
          alt: String(rest.alt ?? ""),
          alignment:
            ALIGN_TO_PROTO[String(rest.alignment ?? "")] ??
            Alignment.ALIGN_INHERIT,
          width: Number(rest.width ?? 0),
          widthType: String(rest.widthType ?? "inherit"),
        }),
      };
      break;
    case NodeType.NODE_HEADING:
      base.data = {
        case: "heading",
        value: create(HeadingDataSchema, {
          tag: TAG_TO_PROTO[String(rest.tag ?? "h1")] ?? HeadingTag.HEADING_H1,
        }),
      };
      break;
    case NodeType.NODE_LIST:
      base.data = {
        case: "list",
        value: create(ListDataSchema, {
          ordered: Boolean(rest.ordered),
          start: Number(rest.start ?? 1),
          listType: String(rest.listType ?? "bullet"),
        }),
      };
      break;
    case NodeType.NODE_LINK:
      base.data = {
        case: "link",
        value: create(LinkDataSchema, {
          url: String(rest.url ?? ""),
          rel: String(rest.rel ?? ""),
          target: String(rest.target ?? ""),
          title: String(rest.title ?? ""),
        }),
      };
      break;
  }

  return base;
}

// ──────────────────────────────────────────────────────────
// Deserialise: proto Document  →  Lexical JSON tree
// ──────────────────────────────────────────────────────────

export function documentToLexical(doc: Document): LexicalNode {
  return convertProtoNode(doc.root!);
}

function convertProtoNode(p: Node): LexicalNode {
  const lexType = PROTO_TO_LEXICAL_TYPE[p.type] ?? "unknown";
  const node: Record<string, unknown> = {
    type: lexType,
    version: p.version,
  };

  for (const [key, val] of Object.entries(p.attrs)) {
    if (val === "") {
      node[key] = null;
    } else if (key === "indent" || key === "textFormat") {
      node[key] = Number(val);
    } else {
      node[key] = val;
    }
  }

  if (p.data.case === "text" && p.data.value) {
    node.text = p.data.value.text;
    node.format = p.data.value.format;
    node.detail = p.data.value.detail;
    node.mode = p.data.value.mode;
    node.style = p.data.value.style;
  } else if (p.data.case === "image" && p.data.value) {
    node.src = p.data.value.src;
    node.alt = p.data.value.alt;
    node.alignment = PROTO_TO_ALIGN[p.data.value.alignment] ?? "";
    node.width = p.data.value.width;
    node.widthType = p.data.value.widthType;
  } else if (p.data.case === "heading" && p.data.value) {
    node.tag = PROTO_TO_TAG[p.data.value.tag] ?? "h1";
  } else if (p.data.case === "list" && p.data.value) {
    node.ordered = p.data.value.ordered;
    node.start = p.data.value.start;
    node.listType = p.data.value.listType;
  } else if (p.data.case === "link" && p.data.value) {
    node.url = p.data.value.url;
    node.rel = p.data.value.rel;
    node.target = p.data.value.target;
    node.title = p.data.value.title;
  }

  if (p.children.length > 0) {
    node.children = p.children.map(convertProtoNode);
  }

  return node as LexicalNode;
}
