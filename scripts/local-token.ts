// The development server's route to api's development token (R44 in docs/decisions.md; section
// 3.7 of docs/architecture.md). api's `just dev-app` writes a Firebase custom token of its
// development account into the volume novatrail-dev-token, which app's container mounts read-only,
// again every half hour, and removes it when it stops (R67 api). The plugin hands it to the local
// build's sign-in, src/signin/local.ts, on the development server alone: `vite build` and
// `vite preview` do not know the route.
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { LOCAL_TOKEN_PATH } from "../src/signin/token-path.ts";

/** Where api's `just dev-app` writes the token (R67 api). */
export const TOKEN_FILE = "/home/vscode/.novatrail-token/custom-token";

/** The plugin of the route; the file is TOKEN_FILE unless given. */
export function localToken(file = TOKEN_FILE): Plugin {
  return {
    name: "app:local-token",
    // `vite preview` resolves serve plugins too, but calls only configurePreviewServer.
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== LOCAL_TOKEN_PATH) {
          next();
          return;
        }
        // Read at each request: api writes the file again by a rename, and removes it.
        let token = "";
        try {
          token = readFileSync(file, "utf8").trim();
        } catch {
          // No file: `just dev-app` is not running.
        }
        if (token === "") {
          response.statusCode = 404;
          response.end();
          return;
        }
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(token);
      });
    },
  };
}
