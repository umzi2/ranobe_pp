import { JSXElement, splitProps } from "solid-js";
import "./ToggleButton.scss";

export interface ToggleButtonProps {
  pressed: boolean;
  onChange: (next: boolean) => void;
  children: JSXElement;
  "aria-label"?: string;
  class?: string;
}

export function ToggleButton(props: ToggleButtonProps) {
  const [local, rest] = splitProps(props, [
    "pressed",
    "onChange",
    "children",
    "class",
  ]);

  return (
    <button
      {...rest}
      type="button"
      aria-pressed={local.pressed}
      class={`editor-toggle-btn${local.pressed ? " pressed" : ""}${local.class ? ` ${local.class}` : ""}`}
      onClick={() => local.onChange(!local.pressed)}
    >
      {local.children}
    </button>
  );
}
