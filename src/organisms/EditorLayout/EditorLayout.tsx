import { JSX } from "solid-js";
import styles from "./EditorLayout.module.scss";

interface EditorLayoutProps {
  toolbar: JSX.Element;
  children: JSX.Element;
}

export const EditorLayout = (props: EditorLayoutProps) => {
  return (
    <div class={styles.portalContainer}>
      <header class={styles.toolbar}>{props.toolbar}</header>
      <main class={styles.content}>{props.children}</main>
    </div>
  );
};
