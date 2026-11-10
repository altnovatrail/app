// What every test in the browser needs: React told that it runs under act(), and every rendered
// tree unmounted after its test. Testing Library registers this itself only with Vitest's globals,
// which this repository does not turn on.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
