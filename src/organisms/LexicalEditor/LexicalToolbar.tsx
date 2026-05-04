import {
  $getSelection,
  $isRangeSelection,
  $isNodeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  ElementFormatType,
  mergeRegister,
} from "lexical";
import {
  $createHeadingNode,
  $isHeadingNode,
  HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  Component,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { useEditor } from "~/molecules/EditorContext/EditorContext";
import {
  TbOutlineBold as IconBold,
  TbOutlineItalic as IconItalic,
  TbOutlineStrikethrough as IconStrike,
  TbOutlineUnderline as IconUnderline,
  TbOutlineAlignLeft as IconAlignLeft,
  TbOutlineAlignCenter as IconAlignCenter,
  TbOutlineAlignRight as IconAlignRight,
  TbOutlineAlignJustified as IconAlignJustify,
  TbOutlinePhoto as IconImage,
  TbOutlineSeparatorHorizontal as IconHr,
} from "solid-icons/tb";
import { ToggleButton } from "~/atoms/ToggleButton/ToggleButton";
import { Tooltip } from "~/atoms/Tooltip/Tooltip";
import { $createImageNode, $isImageNode } from "./nodes/ImageNode";
import { $createHorizontalRuleNode } from "./nodes/HorizontalRuleNode";
import "./LexicalToolbar.scss";

type Alignment = "left" | "center" | "right" | "justify";
type BlockType = "paragraph" | "h1" | "h2" | "h3";

interface TextAction {
  label: string;
  icon: JSXElement;
  pressed: () => boolean;
  onChange: () => void;
}
interface AlignAction {
  label: string;
  icon: JSXElement;
  value: Alignment;
}

export const Toolbar: Component = () => {
  const editor = useEditor();

  const [isBold, setIsBold] = createSignal(false);
  const [isItalic, setIsItalic] = createSignal(false);
  const [isUnderline, setIsUnderline] = createSignal(false);
  const [isStrikethrough, setIsStrikethrough] = createSignal(false);
  const [alignment, setAlignment] = createSignal<Alignment>("left");
  const [blockType, setBlockType] = createSignal<BlockType>("paragraph");
  const [showImgInput, setShowImgInput] = createSignal(false);
  const [imgUrl, setImgUrl] = createSignal("");

  // Track whether an image is selected (for visual feedback)
  const [hasImageSelection, setHasImageSelection] = createSignal(false);

  onMount(() => {
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const sel = $getSelection();

          // ── Image node selection ──
          if ($isNodeSelection(sel)) {
            const hasImg = sel.getNodes().some($isImageNode);
            setHasImageSelection(hasImg);
            return;
          }
          setHasImageSelection(false);

          if (!$isRangeSelection(sel)) return;

          setIsBold(sel.hasFormat("bold"));
          setIsItalic(sel.hasFormat("italic"));
          setIsUnderline(sel.hasFormat("underline"));
          setIsStrikethrough(sel.hasFormat("strikethrough"));

          const anchor = sel.anchor.getNode();
          const element =
            anchor.getKey() === "root"
              ? anchor
              : anchor.getTopLevelElementOrThrow();

          const fmt = (element as any).getFormatType?.() as
            | ElementFormatType
            | undefined;
          setAlignment((fmt as Alignment) || "left");

          if ($isHeadingNode(element)) {
            setBlockType(element.getTag() as BlockType);
          } else {
            setBlockType("paragraph");
          }
        });
      }),
    );
    onCleanup(unregister);
  });

  // Use $setBlocksType — preserves all children and inline formatting
  function setHeading(tag: HeadingTagType) {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;

      const anchor = sel.anchor.getNode();
      const element =
        anchor.getKey() === "root"
          ? anchor
          : anchor.getTopLevelElementOrThrow();

      const isAlreadyThis = $isHeadingNode(element) && element.getTag() === tag;

      if (isAlreadyThis) {
        // Toggle back to paragraph — preserve children
        $setBlocksType(sel, () => $createParagraphNode());
      } else {
        $setBlocksType(sel, () => $createHeadingNode(tag));
      }
    });
  }

  function insertHorizontalRule() {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      const anchor = sel.anchor.getNode();
      const element =
        anchor.getKey() === "root"
          ? anchor
          : anchor.getTopLevelElementOrThrow();
      const hr = $createHorizontalRuleNode();
      const para = $createParagraphNode();
      element.insertAfter(hr);
      hr.insertAfter(para);
      para.select();
    });
  }

  function insertImage() {
    const url = imgUrl().trim();
    if (!url) return;
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      const anchor = sel.anchor.getNode();
      const element = anchor.getTopLevelElementOrThrow();
      const img = $createImageNode(url);
      const para = $createParagraphNode();
      element.insertAfter(img);
      img.insertAfter(para);
      para.select();
    });
    setImgUrl("");
    setShowImgInput(false);
  }

  // (delete is handled in the inline block toolbar)

  const textActions: TextAction[] = [
    {
      label: "Жирный",
      icon: <IconBold />,
      pressed: isBold,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
    },
    {
      label: "Курсив",
      icon: <IconItalic />,
      pressed: isItalic,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
    },
    {
      label: "Подчёркивание",
      icon: <IconUnderline />,
      pressed: isUnderline,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
    },
    {
      label: "Зачёркнутый",
      icon: <IconStrike />,
      pressed: isStrikethrough,
      onChange: () =>
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
    },
  ];

  const alignActions: AlignAction[] = [
    { label: "По левому краю", icon: <IconAlignLeft />, value: "left" },
    { label: "По центру", icon: <IconAlignCenter />, value: "center" },
    { label: "По правому краю", icon: <IconAlignRight />, value: "right" },
    { label: "По ширине", icon: <IconAlignJustify />, value: "justify" },
  ];

  const headings: { tag: HeadingTagType; label: string }[] = [
    { tag: "h1", label: "H1" },
    { tag: "h2", label: "H2" },
    { tag: "h3", label: "H3" },
  ];

  return (
    <div class="editor-toolbar">
      {/* ── Headings ── */}
      <For each={headings}>
        {(h) => (
          <Tooltip content={`Заголовок ${h.tag.toUpperCase()}`}>
            <ToggleButton
              pressed={blockType() === h.tag}
              onChange={() => setHeading(h.tag)}
              aria-label={h.tag.toUpperCase()}
            >
              <span class="toolbar-label">{h.label}</span>
            </ToggleButton>
          </Tooltip>
        )}
      </For>

      <div class="toolbar-divider" />

      {/* ── Text formatting ── */}
      <For each={textActions}>
        {(a) => (
          <Tooltip content={a.label}>
            <ToggleButton
              pressed={a.pressed()}
              onChange={a.onChange}
              aria-label={a.label}
            >
              {a.icon}
            </ToggleButton>
          </Tooltip>
        )}
      </For>

      <div class="toolbar-divider" />

      {/* ── Alignment ── */}
      <For each={alignActions}>
        {(a) => (
          <Tooltip content={a.label}>
            <ToggleButton
              pressed={alignment() === a.value}
              onChange={() =>
                editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, a.value)
              }
              aria-label={a.label}
            >
              {a.icon}
            </ToggleButton>
          </Tooltip>
        )}
      </For>

      <div class="toolbar-divider" />

      {/* ── Horizontal rule ── */}
      <Tooltip content="Разделитель">
        <ToggleButton
          pressed={false}
          onChange={insertHorizontalRule}
          aria-label="Horizontal rule"
        >
          <IconHr />
        </ToggleButton>
      </Tooltip>

      <div class="toolbar-divider" />

      <div class="toolbar-img-group">
        <Tooltip content="Вставить изображение">
          <ToggleButton
            pressed={showImgInput()}
            onChange={(v) => {
              setShowImgInput(v);
              if (!v) setImgUrl("");
            }}
            aria-label="Image"
          >
            <IconImage />
          </ToggleButton>
        </Tooltip>

        <Show when={hasImageSelection()}>
          <span
            class="toolbar-label"
            style="color: $color-text-muted; font-size: 10px;"
          >
            🖼 изображение
          </span>
        </Show>

        <Show when={showImgInput()}>
          <div class="toolbar-img-popover">
            <input
              class="toolbar-img-input"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={imgUrl()}
              onInput={(e) => setImgUrl(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") insertImage();
                if (e.key === "Escape") {
                  setShowImgInput(false);
                  setImgUrl("");
                }
              }}
              ref={(el) => requestAnimationFrame(() => el?.focus())}
            />
            <button
              class="toolbar-img-confirm"
              type="button"
              disabled={!imgUrl().trim()}
              onClick={insertImage}
            >
              ↵
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};
