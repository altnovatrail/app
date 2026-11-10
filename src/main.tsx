// The entry of the app: it renders the shell into the root of index.html.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no element #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
