// The reading of the deployment configuration, /deployment.json, format 1 (R09 in
// docs/decisions.md; section 3.7 of docs/architecture.md): section 5 of spec's text of
// deployment/, in two steps. The schema step is written in code, with the schema's own patterns,
// and the tests hold it to the schema, its examples and the part's vectors of reading. No DOM.
import type { Deployment } from "@altnovatrail/spec/deploymentv1";

export type { Deployment };

/** The step that refuses a file: the schema, or the ID of a rule of reading. */
export type RefusedBy = "schema" | "deployment.api-origin" | "deployment.loopback";

/** What reading a file gives: the configuration, or the step that refused it and its paths. */
export type Reading =
  | { readonly ok: true; readonly deployment: Deployment }
  | { readonly ok: false; readonly refusedBy: RefusedBy; readonly fields: readonly string[] };

/** The version of the format this build reads, as deployment/VERSION of spec's tag has it. */
export const FORMAT = 1;

/** The schema's pattern of `api`: an origin over https, or over http on a loopback host. */
export const API_PATTERN =
  "^(https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[1-9][0-9]{0,4})?|http://(127\\.0\\.0\\.1|localhost|\\[::1\\])(:[1-9][0-9]{0,4})?)$";
/** The schema's pattern of `signIn.authDomain`: a host name in lower case. */
export const AUTH_DOMAIN_PATTERN =
  "^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$";

const API = new RegExp(API_PATTERN, "u");
const AUTH_DOMAIN = new RegExp(AUTH_DOMAIN_PATTERN, "u");

/** The hosts of a loopback origin, written as the URL Standard serializes them (section 5). */
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

type Check = (value: unknown) => boolean;

const nonEmpty: Check = (value) => typeof value === "string" && value.length > 0;

/** The fields of `signIn`, each with what its value has to be. */
const SIGN_IN: Readonly<Record<string, Check>> = {
  service: (value) => value === "firebase",
  apiKey: nonEmpty,
  authDomain: (value) => typeof value === "string" && AUTH_DOMAIN.test(value),
  projectId: nonEmpty,
  appId: nonEmpty,
};

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The paths an object refuses against its fields: missing, unknown, or of a wrong value. */
function refusedFields(
  object: Readonly<Record<string, unknown>>,
  fields: Readonly<Record<string, Check>>,
  prefix: string,
): string[] {
  const refused: string[] = [];
  for (const [name, check] of Object.entries(fields)) {
    if (!Object.hasOwn(object, name) || !check(object[name])) refused.push(`${prefix}${name}`);
  }
  for (const name of Object.keys(object)) {
    if (!Object.hasOwn(fields, name)) refused.push(`${prefix}${name}`);
  }
  return refused;
}

/** The schema step: every path the schema refuses, in the order of code units; empty if none. */
export function schemaRefusals(file: unknown): string[] {
  if (!isObject(file)) return [""];
  const refused = refusedFields(
    file,
    {
      format: (value) => value === FORMAT,
      api: (value) => typeof value === "string" && API.test(value),
      signIn: isObject,
    },
    "",
  );
  if (isObject(file.signIn)) refused.push(...refusedFields(file.signIn, SIGN_IN, "signIn."));
  // The order of code units, as the part asks, not a locale's order.
  return refused.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Whether an origin, as the URL Standard serializes it, is on a loopback host. */
export function isLoopback(origin: string): boolean {
  try {
    return LOOPBACK.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** The origin of a URL as the URL Standard serializes it; undefined for no URL. The schema's
 * pattern passes some that are none, such as a port past 65535 or an address of five numbers. */
function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * Reads a file, as JSON gave it, for app open at an origin: the schema, then the rules in the
 * order of their table. A file is never read in part.
 */
export function readDeployment(file: unknown, appOrigin: string): Reading {
  const fields = schemaRefusals(file);
  if (fields.length > 0) return { ok: false, refusedBy: "schema", fields };
  const deployment = file as Deployment;
  if (originOf(deployment.api) !== deployment.api) {
    return { ok: false, refusedBy: "deployment.api-origin", fields: ["api"] };
  }
  if (deployment.api.startsWith("http:") && !isLoopback(appOrigin)) {
    return { ok: false, refusedBy: "deployment.loopback", fields: ["api"] };
  }
  return { ok: true, deployment };
}
