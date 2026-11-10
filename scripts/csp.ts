// The template of the Content Security Policy, csp.json, and the two layers built from it (R09 in
// docs/decisions.md; section 3.7 of docs/architecture.md). The template is an object "directive →
// string of sources" with the places {api} and {authDomain}, the form infra's rollout reads and
// builds the header from (R17 in infra; the third 2026-11-09 amendment to R85 in spec):
// - the lower layer, a <meta> in the signed index.html, takes `https:` for a source with a place,
//   since the build knows no address, and leaves frame-ancestors out: a <meta> cannot hold it;
// - the header takes the values of /deployment.json for the places, and frame-ancestors 'none'
//   when the template has none, as the rollout does.

/** The template, directive by directive, in its order. */
export type Template = Readonly<Record<string, string>>;

/** The values of the places, from /deployment.json: the origin of api, and the sign-in host. */
export interface Places {
  readonly api: string;
  readonly authDomain: string;
}

const DIRECTIVE = /^[a-z]+(?:-[a-z]+)*$/;
const PLACE = /\{([A-Za-z]+)\}/g;
/** Whether a source holds a place; without the global flag, so a test leaves no state behind. */
const HAS_PLACE = /\{[A-Za-z]+\}/;
const PLACES = new Set(["api", "authDomain"]);
const ANCESTORS = "frame-ancestors";
const NONE = "'none'";

/** What is wrong with a template, by the rules the rollout refuses it by; empty when nothing is. */
export function templateProblems(template: unknown): string[] {
  if (typeof template !== "object" || template === null || Array.isArray(template)) {
    return ["csp.json is not an object of directives"];
  }
  const problems: string[] = [];
  for (const [directive, sources] of Object.entries(template)) {
    if (!DIRECTIVE.test(directive)) problems.push(`${directive} is no directive's name`);
    // A quote or an angle bracket would also break out of the <meta> the lower layer is written in.
    if (typeof sources !== "string" || sources.trim() === "" || /[;,"<>]/.test(sources)) {
      problems.push(`${directive} is not one string of sources`);
      continue;
    }
    for (const [, place] of sources.matchAll(PLACE)) {
      if (!PLACES.has(place as string)) problems.push(`${directive} has the place {${place}}`);
    }
    if (directive === ANCESTORS && sources !== NONE) problems.push(`${ANCESTORS} is not ${NONE}`);
  }
  return problems;
}

/** A policy from directives and their sources. */
function policy(entries: readonly (readonly [string, readonly string[]])[]): string {
  return entries.map(([directive, sources]) => `${directive} ${sources.join(" ")}`).join("; ");
}

/** The lower layer: `https:` for a source with a place, other https sources then dropped. */
export function lowerLayer(template: Template): string {
  const entries: [string, string[]][] = [];
  for (const [directive, sources] of Object.entries(template)) {
    if (directive === ANCESTORS) continue;
    let list = sources.split(/\s+/).map((source) => (HAS_PLACE.test(source) ? "https:" : source));
    if (list.includes("https:")) {
      list = list.filter((source) => source === "https:" || !source.startsWith("https://"));
    }
    entries.push([directive, [...new Set(list)]]);
  }
  return policy(entries);
}

/** The header: the places filled from /deployment.json, and frame-ancestors 'none'. */
export function header(template: Template, places: Places): string {
  const entries: [string, string[]][] = Object.entries(template).map(([directive, sources]) => [
    directive,
    sources.replace(PLACE, (_, place: keyof Places) => places[place]).split(/\s+/),
  ]);
  if (!Object.hasOwn(template, ANCESTORS)) entries.push([ANCESTORS, [NONE]]);
  return policy(entries);
}
