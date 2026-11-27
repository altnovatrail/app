// How long a wait for a condition in a test of the browser may take, in milliseconds: Testing
// Library's findBy… and waitFor, expect.poll and vi.waitFor alike. A wait ends the moment its
// condition holds, so the limit costs a passing test nothing, while the default second runs out on
// a heavy screen when the machine is loaded, as CI's is, and fails a test that is right.
export const WAIT_LIMIT_MS = 5000;
