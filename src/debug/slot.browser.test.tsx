// The debug slot in every build: the window's chunk loaded only once GetDebug answered, and
// no button, no chunk and no stale build when GetDebug refuses — `permission_denied` for an
// account without the right, `unimplemented` beside the stub of tutor; another account asks again.
import { DebugService } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { Code, ConnectError, createRouterTransport } from "@connectrpc/connect";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { reset } from "./debug.ts";
import { signedIn } from "./gate.ts";
import { DebugSlot } from "./slot.tsx";

const chunk = vi.hoisted(() => ({ loaded: 0 }));

vi.mock("./DebugButton.tsx", async (original) => {
  chunk.loaded++;
  return original();
});

const BUTTON = "Debug: the models and their answers";

/** The slot on api whose GetDebug answers by `getDebug`, and what it told the device. */
function renderSlot(getDebug: () => Promise<object>) {
  const stale = vi.fn();
  let asked = 0;
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router) =>
          router.service(DebugService, {
            getDebug: () => {
              asked++;
              return getDebug();
            },
            takeDebugCalls: () => ({}),
          }),
        { transport: { interceptors } },
      ),
  });
  const { container } = render(
    <ApiProvider value={api}>
      <DebugSlot />
    </ApiProvider>,
  );
  return { container, stale, asked: () => asked };
}

const settled = () => new Promise((later) => setTimeout(later, 50));

// The slot unmounted first, so that the gate forgotten makes it ask nothing more.
afterEach(() => {
  cleanup();
  reset();
});

describe("the debug slot", () => {
  it.each([
    ["an account without the right", Code.PermissionDenied],
    ["api beside the stub of tutor", Code.Unimplemented],
  ])("shows nothing and loads no window for %s, and no stale build", async (_, code) => {
    const before = chunk.loaded;
    const { container, stale, asked } = renderSlot(async () => {
      throw new ConnectError("refused", code);
    });
    await settled();
    expect(asked()).toBe(1);
    expect(container).toBeEmptyDOMElement();
    expect(chunk.loaded).toBe(before);
    expect(stale).not.toHaveBeenCalled();
  });

  it("loads the window only once GetDebug answered, and asks again for another account", async () => {
    let answered: () => void = () => {};
    const answer = new Promise<void>((done) => (answered = done));
    const { asked } = renderSlot(async () => {
      await answer;
      return {};
    });
    await settled();
    expect(asked()).toBe(1);
    expect(chunk.loaded).toBe(0);
    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    answered();
    expect(await screen.findByRole("button", { name: BUTTON })).toBeVisible();
    expect(chunk.loaded).toBe(1);

    act(() => signedIn("another"));
    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    expect(await screen.findByRole("button", { name: BUTTON })).toBeVisible();
    expect(asked()).toBe(2);
  });
});
