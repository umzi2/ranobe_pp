import { createSignal, JSXElement, ParentComponent } from "solid-js";

interface TooltipProps {
  content: JSXElement | string;
}

export const Tooltip: ParentComponent<TooltipProps> = (props) => {
  const [open, setOpen] = createSignal(false);

  return (
    <div
      class="tooltip-wrapper"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {props.children}
      {open() && props.content && (
        <div class="tooltip-popup">{props.content}</div>
      )}
    </div>
  );
};