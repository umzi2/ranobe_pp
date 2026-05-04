import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  ElementFormatType,
  mergeRegister,
} from "lexical";
import { Component, createSignal, For, JSXElement, onCleanup, onMount } from "solid-js";
import { useEditor } from "~/molecules/LexicalEditor/useEditor";
import {
  TbOutlineBold          as IconBold,
  TbOutlineItalic        as IconItalic,
  TbOutlineStrikethrough as IconStrike,
  TbOutlineUnderline     as IconUnderline,
  TbOutlineAlignLeft     as IconAlignLeft,
  TbOutlineAlignCenter   as IconAlignCenter,
  TbOutlineAlignRight    as IconAlignRight,
  TbOutlineAlignJustified as IconAlignJustify,
} from "solid-icons/tb";
import { ToggleButton } from "~/atoms/ToggleButton/ToggleButton";
import { Tooltip }      from "~/atoms/Tooltip/Tooltip";
import "./LexicalToolbar.scss";

type Alignment = "left" | "center" | "right" | "justify";

interface TextAction {
  kind: "text";
  label: string;
  icon: JSXElement;
  pressed: () => boolean;
  onChange: () => void;
}
interface AlignAction {
  kind: "align";
  label: string;
  icon: JSXElement;
  value: Alignment;
}

export const Toolbar: Component = () => {
  const editor = useEditor();

  const [isBold,          setIsBold]          = createSignal(false);
  const [isItalic,        setIsItalic]        = createSignal(false);
  const [isUnderline,     setIsUnderline]     = createSignal(false);
  const [isStrikethrough, setIsStrikethrough] = createSignal(false);
  const [alignment,       setAlignment]       = createSignal<Alignment>("left");

  onMount(() => {
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const sel = $getSelection();
          if ($isRangeSelection(sel)) {
            setIsBold(sel.hasFormat("bold"));
            setIsItalic(sel.hasFormat("italic"));
            setIsUnderline(sel.hasFormat("underline"));
            setIsStrikethrough(sel.hasFormat("strikethrough"));

            const anchorNode = sel.anchor.getNode();
            const element = anchorNode.getKey() === "root"
              ? anchorNode
              : anchorNode.getTopLevelElementOrThrow();
            const fmt = (element as any).getFormatType?.() as ElementFormatType | undefined;
            setAlignment((fmt as Alignment) || "left");
          }
        });
      })
    );
    onCleanup(unregister);
  });

  const textActions: TextAction[] = [
    {
      kind: "text",
      label: "Жирный",
      icon: <IconBold />,
      pressed: isBold,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
    },
    {
      kind: "text",
      label: "Курсив",
      icon: <IconItalic />,
      pressed: isItalic,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
    },
    {
      kind: "text",
      label: "Подчёркивание",
      icon: <IconUnderline />,
      pressed: isUnderline,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
    },
    {
      kind: "text",
      label: "Зачёркнутый",
      icon: <IconStrike />,
      pressed: isStrikethrough,
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
    },
  ];

  const alignActions: AlignAction[] = [
    { kind: "align", label: "По левому краю", icon: <IconAlignLeft />,    value: "left"    },
    { kind: "align", label: "По центру",       icon: <IconAlignCenter />,  value: "center"  },
    { kind: "align", label: "По правому краю", icon: <IconAlignRight />,   value: "right"   },
    { kind: "align", label: "По ширине",       icon: <IconAlignJustify />, value: "justify" },
  ];

  return (
    <div class="editor-toolbar">
      <For each={textActions}>
        {(action) => (
          <Tooltip content={action.label}>
            <ToggleButton pressed={action.pressed()} onChange={action.onChange} aria-label={action.label}>
              {action.icon}
            </ToggleButton>
          </Tooltip>
        )}
      </For>

      <div class="toolbar-divider" />

      <For each={alignActions}>
        {(action) => (
          <Tooltip content={action.label}>
            <ToggleButton
              pressed={alignment() === action.value}
              onChange={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, action.value)}
              aria-label={action.label}
            >
              {action.icon}
            </ToggleButton>
          </Tooltip>
        )}
      </For>
    </div>
  );
};