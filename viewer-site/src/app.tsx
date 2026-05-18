// ──────────────────────────────────────────────────────────
// App — роутер
//   /         → плейсхолдер
//   /:id      → загружает документ по ID
// ──────────────────────────────────────────────────────────

import { Router, Route } from "@solidjs/router";
import { ViewerApp } from "./components/ViewerApp";

export function App() {
  return (
    <Router>
      <Route path="/" component={ViewerApp} />
      <Route path="/:id" component={ViewerApp} />
    </Router>
  );
}
