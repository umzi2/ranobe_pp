import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  mergeRegister,
} from "lexical";
import { Component, createSignal, For, JSXElement, onCleanup, onMount } from "solid-js";
import { useEditor } from "~/molecules/LexicalEditor/useEditor";
import {
  TbOutlineBold        as IconBold,
  TbOutlineItalic      as IconItalic,
  TbOutlineStrikethrough as IconStrike,
  TbOutlineUnderline   as IconUnderline,
} from "solid-icons/tb";
import { ToggleButton } from "~/atoms/ToggleButton/ToggleButton";
import { Tooltip }      from "~/atoms/Tooltip/Tooltip";
import "./LexicalToolbar.scss";

interface Action {
  label: string;
  icon: JSXElement;
  pressed: () => boolean;
  onChange: () => void;
}

export const Toolbar: Component = () => {
  const editor = useEditor();

  const [isBold,          setIsBold]          = createSignal(false);
  const [isItalic,        setIsItalic]        = createSignal(false);
  const [isUnderline,     setIsUnderline]     = createSignal(false);
  const [isStrikethrough, setIsStrikethrough] = createSignal(false);

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
          }
        });
      })
    );
    onCleanup(unregister);
  });

  const actions: Action[] = [
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
      onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
    },
  ];

  return (
    <div class="editor-toolbar">
      <For each={actions}>
        {(action) => (
          <Tooltip content={action.label}>
            <ToggleButton
              pressed={action.pressed()}
              onChange={action.onChange}
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