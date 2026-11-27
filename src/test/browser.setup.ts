// What every test in the browser needs: React told that it runs outside act() but for Testing
// Library's render and act, and every rendered tree unmounted after its test, the pens a test chose
// forgotten with it. The tests click and type through Vitest's userEvent, real events of the
// browser that no act() wraps: with the flag on, React warned of every update they caused, 10 958
// times in one run of CI. Testing Library's render and act turn the flag on for their own time, so
// React still flushes inside them. Testing Library registers its cleanup itself only with Vitest's
// globals, which this repository does not turn on. Every wait for a condition gets the limit of
// ./wait.ts: Testing Library's here, vi.waitFor's here as its default, since Vitest has no setting
// for it, and expect.poll's in vitest.config.ts.
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { forgetPens } from "../canvas/pens.ts";
import { WAIT_LIMIT_MS } from "./wait.ts";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = false;

configure({ asyncUtilTimeout: WAIT_LIMIT_MS });

const waitFor = vi.waitFor;
vi.waitFor = ((callback, options) =>
  waitFor(
    callback,
    typeof options === "number" ? options : { timeout: WAIT_LIMIT_MS, ...options },
  )) as typeof vi.waitFor;

afterEach(() => {
  cleanup();
  forgetPens();
});
