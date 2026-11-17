// The client of api for the tests in the browser: the routes a test gives, behind the client's own
// interceptors, with a token that is always there and no wait between repeats.
import type { ConnectRouter } from "@connectrpc/connect";
import { createRouterTransport } from "@connectrpc/connect";
import { createApi } from "../api/client.ts";

export function routedApi(routes: (router: ConnectRouter) => void) {
  return createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
}
