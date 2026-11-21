// Whether the account has the debug mode (R72): GetDebug asked once an account, the asking under
// way joined; `permission_denied` and `unimplemented` turn it off, any other failure leaves it to
// be asked again; another account signed in forgets the answer, and one that comes after.
import {
  type GetDebugResponse,
  GetDebugResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code } from "@connectrpc/connect";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError, type Failure } from "../api/failure.ts";
import { ask, reset, signedIn, snapshot } from "./gate.ts";

type DebugClient = Parameters<typeof ask>[0];

/** A client whose GetDebug answers by `answer`, counting its askings. */
function client(answer: () => Promise<GetDebugResponse>) {
  const c = {
    asked: 0,
    getDebug: async () => {
      c.asked++;
      return answer();
    },
  };
  return c;
}

const refusing = (failure: Failure) =>
  client(async () => {
    throw new ApiError(failure);
  });

afterEach(() => reset());

describe("the gate of the debug mode", () => {
  it("asks once an account, joins the asking under way, and holds the answer", async () => {
    const answer = create(GetDebugResponseSchema, { models: [{ id: "m" }] });
    const c = client(async () => answer);
    const first = ask(c as unknown as DebugClient);
    expect(ask(c as unknown as DebugClient)).toBe(first);
    expect(snapshot().status).toBe("asking");
    await expect(first).resolves.toBe(answer);
    await expect(ask(c as unknown as DebugClient)).resolves.toBe(answer);
    expect(snapshot()).toMatchObject({ status: "on", answer });
    expect(c.asked).toBe(1);
  });

  it.each<[string, Failure]>([
    ["an account without the right", { kind: "forbidden" }],
    ["api beside the stub of tutor", { kind: "stale" }],
  ])("is off for %s, and asks no more", async (_, failure) => {
    const c = refusing(failure);
    await expect(ask(c as unknown as DebugClient)).resolves.toBeUndefined();
    expect(snapshot().status).toBe("off");
    await ask(c as unknown as DebugClient);
    expect(c.asked).toBe(1);
  });

  it("asks again after a failure that is no refusal", async () => {
    const c = refusing({ kind: "unknown", code: Code.Internal });
    await expect(ask(c as unknown as DebugClient)).resolves.toBeUndefined();
    expect(snapshot().status).toBe("unknown");
    await ask(c as unknown as DebugClient);
    expect(c.asked).toBe(2);
    await expect(ask(undefined)).resolves.toBeUndefined();
  });

  it("forgets the answer with the account, and an answer that comes after", async () => {
    signedIn("a");
    const off = refusing({ kind: "forbidden" });
    await ask(off as unknown as DebugClient);
    expect(snapshot().status).toBe("off");
    const before = snapshot().account;
    // The same user again is the same account.
    signedIn("a");
    expect(snapshot().account).toBe(before);

    let answered: () => void = () => {};
    const late = client(async () => {
      await new Promise<void>((done) => (answered = done));
      return create(GetDebugResponseSchema);
    });
    signedIn("b");
    expect(snapshot()).toMatchObject({ status: "unknown", account: before + 1 });
    const asked = ask(late as unknown as DebugClient);
    signedIn(null);
    answered();
    await expect(asked).resolves.toBeUndefined();
    expect(snapshot().status).toBe("unknown");
  });
});
