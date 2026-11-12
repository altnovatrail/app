// Where the hash of the address meets the app: going to a route, and the current route as React
// sees it. What a hash means is hash.ts, which needs no DOM.
import { useSyncExternalStore } from "react";
import { formatHash, parseHash, type Route } from "./hash.ts";

export { ADULTS, HOME, LESSON, type Route, TASK } from "./hash.ts";

/**
 * Goes to a route: a new entry of the history, so that the browser's "back" returns. Going to the
 * route already shown — under whatever spelling of its hash, an empty one too — adds none.
 */
export function navigate(route: Route): void {
  const hash = formatHash(route);
  if (formatHash(parseHash(window.location.hash)) !== hash) window.location.hash = hash;
}

/**
 * Goes to a route in place of the one shown: no new entry of the history, so that "back" does not
 * return to a screen that only sent the learner on — the task screen with no attempt open.
 */
export function redirect(route: Route): void {
  const hash = formatHash(route);
  if (formatHash(parseHash(window.location.hash)) !== hash) window.location.replace(hash);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function snapshot(): string {
  return window.location.hash;
}

// The route of the last hash read, so that the same hash gives the same object: a screen that
// depends on its route re-runs only when the route changes.
let last: { readonly hash: string; readonly route: Route } | undefined;

/** The route of a hash, the same object for the same hash as the last call. */
export function routeOf(hash: string): Route {
  if (last?.hash !== hash) last = { hash, route: parseHash(hash) };
  return last.route;
}

/** The current route, which changes with the hash. */
export function useRoute(): Route {
  return routeOf(useSyncExternalStore(subscribe, snapshot));
}
