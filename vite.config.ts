// The build of the app (R03, R14 and R15 in docs/decisions.md; section 3.1 of docs/architecture.md).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { canvasCopy } from "./scripts/canvas-dev.ts";
import { deployment } from "./scripts/deployment-plugin.ts";
import { localToken } from "./scripts/local-token.ts";

// One port for the development server and for `vite preview`, which neither moves off quietly:
// the local deployment configuration names the origin (section 3.7).
const port = 5173;

// The paths of api — its services and the files of packages' device parts — which a local run
// sends to a local api: in deployment.local.json api is app's own origin, so that both layers of
// the CSP let them through as 'self' (section 3.7). The local api is api's devcontainer by its name
// on the Docker network novatrail-api, which app's container joins too (R19; Д21 closed by R44), or
// wherever NOVATRAIL_API says.
const apiTarget = process.env.NOVATRAIL_API || "http://api:8080";
const proxy = {
  "^/novatrail\\.": { target: apiTarget, changeOrigin: true },
  "^/packages/": { target: apiTarget, changeOrigin: true },
};

export default defineConfig(({ command, isPreview }) => {
  // A working copy of canvas, on the development server alone, by `just dev-canvas` (Д3 in RUN.md);
  // `just dev` clears the variable, and neither the build nor `vite preview` reads it.
  const folder = process.env.NOVATRAIL_CANVAS;
  const copy = command === "serve" && isPreview !== true && folder ? canvasCopy(folder) : undefined;
  return {
    // The route to api's development token, on the development server alone (R44).
    plugins: [react(), deployment(), localToken()],
    resolve: { alias: copy?.aliases ?? [] },
    // No fallback to index.html for a path that is not there, as on a hosting with no rules: the
    // screens live in the hash (R14), and a missing /deployment.json answers 404, not the page.
    appType: "mpa",
    build: {
      // Not dist/: that folder holds the files of a release alone (section 3.1).
      outDir: "build",
      emptyOutDir: true,
      // lightningcss, Vite's default, handles nothing that ships (R03).
      cssMinify: "esbuild",
      // No data: addresses, which the CSP does not allow (section 3.7).
      assetsInlineLimit: 0,
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      // Without a list, the development server would hand out the whole repository. NOTICE and
      // LICENSE the page of notices takes in as text (R31).
      fs: {
        strict: true,
        allow: [
          "index.html",
          "src",
          "node_modules",
          "NOTICE",
          "LICENSE",
          ...(copy ? [copy.allow] : []),
        ],
      },
      proxy,
    },
    preview: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      proxy,
    },
  };
});
