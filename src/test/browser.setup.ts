// What every test in the browser needs: React told that it runs outside act() but for Testing
// Library's render and act, and every rendered tree unmounted after its test. The tests click and
// type through Vitest's userEvent, real events of the browser that no act() wraps: with the flag
// on, React warned of every update they caused, 10 958 times in one run of CI. Testing Library's
// render and act turn the flag on for their own time, so React still flushes inside them. Testing
// Library registers its cleanup itself only with Vitest's globals, which this repository does not
// turn on.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = false;

afterEach(() => {
  cleanup();
});
