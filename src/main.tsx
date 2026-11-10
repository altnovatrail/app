// The entry of the app: it renders the start into the root of index.html, and the shell once the
// deployment configuration is read and the storage on the device started (sections 3.2 and 3.7 of
// docs/architecture.md).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { Boot } from "./boot/Boot.tsx";
import { browserDevice } from "./storage/browser.ts";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no element #root");
createRoot(root).render(
  <StrictMode>
    <Boot
      framed={window.top !== window.self}
      origin={window.location.origin}
      languages={navigator.languages}
      device={browserDevice()}
    >
      <App />
    </Boot>
  </StrictMode>,
);
