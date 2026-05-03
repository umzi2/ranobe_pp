import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, mergeRegister } from "lexical";
import { Component, createSignal, For, JSXElement, onCleanup, onMount, ParentComponent, splitProps } from "solid-js";
import { useEditor } from "~/molecules/LexicalEditor/useEditor";
import { TbOutlineBold as IconBold, TbOutlineItalic as IconItalic, TbOutlineStrikethrough as IconStrikethrough,TbOutlineUnderline as IconUnderline } from 'solid-icons/tb'
interface Action {
  label: string;
  icon: JSXElement;
  pressed: () => boolean;
  onChange: (pressed: boolean) => void;
}

interface TooltipProps {
  content: JSXElement | string;
}
interface ToggleButtonProps {
  pressed: boolean;
  onChange: (next: boolean) => void;
  children: JSXElement;
  "aria-label"?: string;
}

export function ToggleButton(props: ToggleButtonProps) {
  const [local, rest] = splitProps(props, ["pressed", "onChange", "children"]);

  return (
    <button
      {...rest}
      type="button"
      aria-pressed={local.pressed}
      class={`editor-toggle-btn ${local.pressed ? "pressed" : ""}`}
      onClick={() => local.onChange(!local.pressed)}
    >
      {local.children}
    </button>
  );
}
export const Tooltip: ParentComponent<TooltipProps> = (props) => {
  const [open, setOpen] = createSignal(false);

  return (
    <div
      class="editor-tooltip-wrapper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {props.children}
      {open() && (
        <div class="editor-tooltip-popup">{props.content}</div>
      )}
    </div>
  );
};

export const Toolbar: Component = () => {
  const editor = useEditor();
  const [isBold, setIsBold] = createSignal(false);
  const [isItalic, setIsItalic] = createSignal(false);
  const [isUnderline, setIsUnderline] = createSignal(false);
  const [isStrikethrough, setIsStrikethrough] = createSignal(false);

  onMount(() => {
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            setIsBold(selection.hasFormat("bold"));
            setIsItalic(selection.hasFormat("italic"));
            setIsUnderline(selection.hasFormat("underline"));
            setIsStrikethrough(selection.hasFormat("strikethrough"));
          }
        });
      }),
    );
    onCleanup(unregister);
  });

  const groups: Action[][] = [
    [
      {
        label: "Жирный",
        icon: <IconBold class="size-4" />,
        pressed: isBold,
        onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"),
      },
      {
        label: "Курсив",
        icon: <IconItalic class="size-4" />,
        pressed: isItalic,
        onChange: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"),
      },
      {
        label: "Нижнее подчёркивание",
        icon: <IconUnderline class="size-4" />,
        pressed: isUnderline,
        onChange: () =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline"),
      },
      {
        label: "Зачёркнутый",
        icon: <IconStrikethrough class="size-4" />,
        pressed: isStrikethrough,
        onChange: () =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough"),
      },
    ],
  ];

  return (
    <div class="editor-toolbar">
      <For each={groups}>
        {(group) => (
          <div style="display: flex; gap: 4px;">
            <For each={group}>
              {(action) => (
                <Tooltip content={""}>
                  <ToggleButton
                    pressed={action.pressed()}
                    onChange={action.onChange}
                    // aria-label={action.label}
                  >
                    {action.icon}
                  </ToggleButton>
                </Tooltip>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
};