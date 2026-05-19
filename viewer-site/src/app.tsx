// ──────────────────────────────────────────────────────────
// App
//   /         → плейсхолдер
//   /:id      → загружает документ по ID
//
// Без @solidjs/router — только popstate + pathname
// ──────────────────────────────────────────────────────────

import { createSignal, onMount, onCleanup } from "solid-js";
import { ViewerApp } from "./components/ViewerApp";

export function App() {
  const [docId, setDocId] = createSignal<string | undefined>();

  function syncPath() {
    const p = window.location.pathname.replace(/^\/+/, "");
    setDocId(p || undefined);
  }

  onMount(() => {
    syncPath();
    window.addEventListener("popstate", syncPath);
    onCleanup(() => window.removeEventListener("popstate", syncPath));
  });

  return <ViewerApp docId={docId()} />;
}
