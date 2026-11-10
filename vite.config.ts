// The build of the app (R03 and R14 in docs/decisions.md; section 3.1 of docs/architecture.md).
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One port for the development server and for `vite preview`, which neither moves off quietly:
// the local deployment configuration names the origin (section 3.7).
const port = 5173;

export default defineConfig({
  plugins: [react()],
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
    // Without a list, the development server would hand out the whole repository.
    fs: { strict: true, allow: ["index.html", "src", "node_modules"] },
  },
  preview: {
    host: "127.0.0.1",
    port,
    strictPort: true,
  },
});
