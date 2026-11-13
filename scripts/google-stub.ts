// Stand-ins for Google, for the tests that open the sign-in window of the built page with no
// network: the built page test and the site check's own test (section 3.7 of
// docs/architecture.md).
import type { BrowserContext } from "playwright";

/**
 * The script of gapi in place of Google's, which is closed to reading: it gives the SDK what it
 * calls — the loader, and a context that puts the hidden iframe of the sign-in pages in the page
 * and says it is there once it has loaded — and calls the SDK back by the name in its address.
 */
export const GAPI = `(() => {
  const frames = {
    CROSS_ORIGIN_IFRAMES_FILTER: {},
    Iframe: function Iframe() {},
    getContext: () => ({
      open(options, ready) {
        const frame = document.createElement("iframe");
        frame.src = options.url;
        frame.setAttribute("aria-hidden", "true");
        const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
        options.where.appendChild(frame);
        return ready({
          restyle: async () => {},
          ping: () => loaded,
          register() {},
          send() {},
        });
      },
    }),
  };
  window.gapi = { load: (_, options) => options.callback(), iframes: frames };
  const onload = new URL(document.currentScript.src).searchParams.get("onload");
  if (onload) window[onload]();
})();`;

/**
 * Answers every request of a context off an origin as Google would, with no network: the script of
 * gapi, the project's configuration with its authorized domains, and the sign-in pages as an empty
 * page. Each request's host goes to `seen`, in its order.
 */
export async function standInForGoogle(
  context: BrowserContext,
  origin: string,
  authorizedDomains: () => readonly string[],
  seen: string[] = [],
): Promise<void> {
  await context.route(
    (url) => url.origin !== origin,
    async (route) => {
      const url = new URL(route.request().url());
      seen.push(url.host);
      if (url.host === "apis.google.com") {
        await route.fulfill({ contentType: "text/javascript", body: GAPI });
      } else if (url.host === "identitytoolkit.googleapis.com") {
        await route.fulfill({
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
          body: JSON.stringify({
            projectId: "example-project",
            authorizedDomains: authorizedDomains(),
          }),
        });
      } else {
        await route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>auth</title>",
        });
      }
    },
  );
}
