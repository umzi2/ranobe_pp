import { JSX } from "solid-js";
import styles from "./Layout.module.scss";

interface LayoutProps {
  toolbar: JSX.Element;
  children: JSX.Element;
}

export const Layout = (props: LayoutProps) => {
  return (
    <div class={styles.portalContainer}>
      <header class={styles.toolbar}>
        {props.toolbar}
      </header>
      
      <main class={styles.content}>
        {props.children}
      </main>
    </div>
  );
};