// The screens of the app live in the hash of its address: /#/<screen>/<part>/… (R14 in
// docs/decisions.md). Any hosting serves the one index.html at the root, with no rule of its own,
// and the browser sends no fragment to the server, so no hosting log learns which screen a learner
// is on. A route names a screen and the IDs of content it shows, never the ID of a profile, an
// account, an attempt or a lesson run.

/** A screen and its parts, as the hash names them. */
export interface Route {
  readonly screen: string;
  readonly parts: readonly string[];
}

/** The screen that an empty or unknown hash shows. */
export const HOME: Route = { screen: "home", parts: [] };

/** The task screen: the attempt open, which the hash never names (R14). */
export const TASK: Route = { screen: "task", parts: [] };

/** The lesson player: the lesson run open, which the hash never names either (R23). */
export const LESSON: Route = { screen: "lesson", parts: [] };

/**
 * The section for adults, its first page; `#/adults/<page>` is each of its other pages, a profile's
 * among them for the profile chosen in the section, which the hash never names either (R29).
 */
export const ADULTS: Route = { screen: "adults", parts: [] };

/**
 * The legal pages, their list first; `#/legal/<page>` is each page — a legal text by its ID, the
 * page Accessibility and the notices of third-party code (R31). They show before signing in too.
 */
export const LEGAL: Route = { screen: "legal", parts: [] };

/** The screens this build knows. A hash that names another one shows the home screen. */
export const SCREENS: ReadonlySet<string> = new Set([
  HOME.screen,
  TASK.screen,
  LESSON.screen,
  ADULTS.screen,
  LEGAL.screen,
]);

/** The route a hash names: `#/screen/part`, each segment percent-encoded. */
export function parseHash(hash: string): Route {
  if (!hash.startsWith("#/")) return HOME;
  const segments = hash.slice(2).split("/");
  let decoded: string[];
  try {
    decoded = segments.map((segment) => decodeURIComponent(segment));
  } catch {
    // A malformed escape, typed in by hand or cut short.
    return HOME;
  }
  const [screen, ...parts] = decoded;
  if (screen === undefined || !SCREENS.has(screen) || parts.some((part) => part === "")) {
    return HOME;
  }
  return { screen, parts };
}

/** The hash of a route, each segment percent-encoded. */
export function formatHash(route: Route): string {
  return `#/${[route.screen, ...route.parts].map((segment) => encodeURIComponent(segment)).join("/")}`;
}
