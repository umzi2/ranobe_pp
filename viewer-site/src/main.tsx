// ──────────────────────────────────────────────────────────
// Ranobe Viewer — точка входа Solid.js
// ──────────────────────────────────────────────────────────

import { render } from "solid-js/web";
import { App } from "./app";

render(() => <App />, document.getElementById("app")!);
