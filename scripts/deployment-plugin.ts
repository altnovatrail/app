// app's own plugin of Vite for the deployment configuration and the CSP (R09 in
// docs/decisions.md; sections 3.1 and 3.7 of docs/architecture.md):
// - at the build, the lower layer of the CSP goes into <head> right after <meta charset>, and the
//   build stops if anything else stands before it; csp.json and spec's deployment.schema.json, from
//   the file of spec's release in parts/, go into the build beside index.html, as infra's rollout
//   reads them (R17 in infra);
// - on the development server and in `vite preview`, /deployment.json is deployment.local.json,
//   whose api has to be the origin of the server that serves it; `vite preview` also sends the
//   header the rollout would build from csp.json, so that a local run holds both layers.
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";
import { DEPLOYMENT_ARCHIVE, deploymentPart, partText } from "./archive.ts";
import { header, lowerLayer, type Places, type Template, templateProblems } from "./csp.ts";

/** Where the plugin reads from, from the repository's root unless given. */
export interface Options {
  /** The template of the CSP. */
  readonly template?: string;
  /** The file of spec's release that holds the part deployment/, and so its schema. */
  readonly archive?: string;
  /** The local deployment configuration, kept out of git. */
  readonly local?: string;
  /** Whether `vite preview` sends the header; a test turns it off, as a hosting without headers. */
  readonly previewHeader?: boolean;
}

const CHARSET = /^(\s*<!doctype html>\s*<html[^>]*>\s*<head>\s*<meta charset="UTF-8"\s*\/?>)/i;
const LAYER_FIRST =
  /^\s*<!doctype html>\s*<html[^>]*>\s*<head>\s*<meta charset="UTF-8"\s*\/?>\s*<meta http-equiv="Content-Security-Policy" content="[^"]*"\s*\/?>/i;

/** The <meta> of the lower layer. */
export function layerTag(template: Template): string {
  return `<meta http-equiv="Content-Security-Policy" content="${lowerLayer(template)}" />`;
}

/** index.html with the lower layer right after <meta charset>; refused without that start. */
export function withLayer(html: string, template: Template): string {
  if (!CHARSET.test(html)) {
    throw new Error('index.html does not begin its <head> with <meta charset="UTF-8">');
  }
  return html.replace(CHARSET, (start) => `${start}\n    ${layerTag(template)}`);
}

/** Whether the lower layer is the first thing in <head> after <meta charset>. */
export function layerIsFirst(html: string): boolean {
  return LAYER_FIRST.test(html);
}

/** What is wrong with a local file against the origin of the server; undefined when nothing. */
export function localProblem(text: string, origin: string): string | undefined {
  let file: { api?: unknown };
  try {
    file = JSON.parse(text);
  } catch {
    return "deployment.local.json is not JSON";
  }
  if (file?.api !== origin) {
    return `deployment.local.json names api ${String(file?.api)}, not this server's origin ${origin}`;
  }
  return undefined;
}

/** The values of the places from a local file, if it holds both. */
export function placesOf(text: string): Places | undefined {
  const file = JSON.parse(text) as { api?: unknown; signIn?: { authDomain?: unknown } } | null;
  const api = file?.api;
  const authDomain = file?.signIn?.authDomain;
  return typeof api === "string" && typeof authDomain === "string"
    ? { api, authDomain }
    : undefined;
}

type Server = ViteDevServer | PreviewServer;

/** The origin a server answers on, from its configuration: one host, one port. */
function originOf(server: Server, preview: boolean): string {
  const options = preview ? server.config.preview : server.config.server;
  return `http://${String(options.host)}:${options.port}`;
}

/** The plugin, reading its files from the paths given. */
export function deployment(options: Options = {}): Plugin {
  const templatePath = options.template ?? "csp.json";
  const archivePath = options.archive ?? DEPLOYMENT_ARCHIVE;
  const localPath = options.local ?? "deployment.local.json";
  const readTemplate = (): Template => {
    const template: unknown = JSON.parse(readFileSync(templatePath, "utf8"));
    const problems = templateProblems(template);
    if (problems.length > 0) throw new Error(`csp.json: ${problems.join("; ")}`);
    return template as Template;
  };

  /** Answers /deployment.json from the local file, if there is one; otherwise the 404 of mpa. */
  const serve = (server: Server, preview: boolean) => {
    const origin = originOf(server, preview);
    const template = preview ? readTemplate() : undefined;
    return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
      // The local file, read once a request: it may change while the server runs.
      const text = existsSync(localPath) ? readFileSync(localPath, "utf8") : undefined;
      const problem = text === undefined ? undefined : localProblem(text, origin);
      if (template !== undefined && options.previewHeader !== false && text !== undefined) {
        // The header the rollout would build, only from a file it would take.
        const places = problem === undefined ? placesOf(text) : undefined;
        if (places !== undefined) {
          response.setHeader("Content-Security-Policy", header(template, places));
        }
      }
      if (request.url?.split("?")[0] !== "/deployment.json" || text === undefined) {
        next();
        return;
      }
      if (problem !== undefined) {
        server.config.logger.error(problem);
        response.statusCode = 404;
        response.end();
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-cache");
      response.end(text);
    };
  };

  return {
    name: "app:deployment",
    // After Vite's own HTML plugin, whose generateBundle puts index.html into the bundle.
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        // The development server has no lower layer: React Refresh's preamble is an inline script.
        return context.server === undefined ? withLayer(html, readTemplate()) : html;
      },
    },
    generateBundle(_, bundle) {
      const page = bundle["index.html"];
      const html = page?.type === "asset" ? String(page.source) : "";
      if (!layerIsFirst(html)) {
        this.error("the lower layer of the CSP is not first in <head> after <meta charset>");
      }
      this.emitFile({ type: "asset", fileName: "csp.json", source: readFileSync(templatePath) });
      this.emitFile({
        type: "asset",
        fileName: "deployment.schema.json",
        source: partText(deploymentPart(archivePath), "schemas/deployment.schema.json"),
      });
    },
    configureServer(server) {
      server.middlewares.use(serve(server, false));
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve(server, true));
    },
  };
}
