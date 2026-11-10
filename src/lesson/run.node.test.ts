// What app reads of a lesson run (section 3.4 of docs/architecture.md; R06, R23): the full ID, the
// kinds of segments, the words of each end of a run, the places a refusal carries, and the check of
// a demo state kept.
import {
  Cause,
  EndedSegmentsSchema,
  RunEndReason,
  RunEndSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import type { Failure } from "../api/failure.ts";
import { demoOf, endedOf, endKey, fullId, kindOf, moduleOf, runEndOf } from "./run.ts";

const refusal = (cause: Cause, data: Extract<Failure, { kind: "refused" }>["data"]): Failure => ({
  kind: "refused",
  cause,
  data,
  code: Code.FailedPrecondition,
});

describe("a lesson run", () => {
  it("names the lesson by its full ID, as LessonRunRef does, and its module by it", () => {
    const id = fullId("novatrail/olympiad-math", "counting-gaps-1");
    expect(id).toBe("novatrail/olympiad-math/lesson/counting-gaps-1");
    expect(moduleOf(id)).toBe("novatrail/olympiad-math");
    expect(moduleOf("not-a-full-id")).toBe("not-a-full-id");
  });

  it("knows each kind of segment, and reads one of a kind it does not know as an explanation", () => {
    expect(kindOf({ explanation: [{ text: "A" }] })).toBe("explanation");
    expect(kindOf({ task: "gaps-ladder-1" })).toBe("task");
    expect(
      kindOf({
        worked_example: {
          statement: [{ text: "A" }],
          canvas: { kind: "handwriting_sheet" },
          demo: [{ text: "B" }],
        },
      }),
    ).toBe("example");
    expect(kindOf({})).toBe("explanation");
  });

  it("words each end of a run, and one this build does not know as an end all the same", () => {
    expect(endKey(RunEndReason.PASSED)).toBe("lesson.complete");
    expect(endKey(RunEndReason.UNCHECKED)).toBe("api.version-gone");
    expect(endKey(RunEndReason.NOT_SUITABLE)).toBe("lesson.ended-not-suitable");
    expect(endKey(RunEndReason.ABANDONED)).toBe("lesson.ended-abandoned");
    expect(endKey(RunEndReason.UNSPECIFIED)).toBe("lesson.ended");
    expect(endKey(99 as RunEndReason)).toBe("lesson.ended");
  });

  it("reads how a run ended from CAUSE_RUN_ENDED, with or without its end", () => {
    const end = create(RunEndSchema, { reason: RunEndReason.ABANDONED });
    expect(runEndOf(refusal(Cause.RUN_ENDED, { case: "runEnd", value: end }))).toBe(
      RunEndReason.ABANDONED,
    );
    expect(runEndOf(refusal(Cause.RUN_ENDED, { case: undefined }))).toBe(RunEndReason.UNSPECIFIED);
    expect(runEndOf(refusal(Cause.NOT_FOUND, { case: undefined }))).toBeUndefined();
    expect(runEndOf({ kind: "offline" })).toBeUndefined();
  });

  it("reads the places of the task segments that ended from the two refusals that carry them", () => {
    const places = create(EndedSegmentsSchema, { places: [3] });
    const data = { case: "endedSegments", value: places } as const;
    expect(endedOf(refusal(Cause.SEGMENTS_NOT_ENDED, data))).toEqual([3]);
    expect(endedOf(refusal(Cause.SEGMENT_UNAVAILABLE, data))).toEqual([3]);
    // A refusal without its places says nothing of them: they are asked again, not taken as none.
    expect(endedOf(refusal(Cause.SEGMENT_UNAVAILABLE, { case: undefined }))).toBe("unsaid");
    expect(endedOf(refusal(Cause.RUN_ENDED, { case: undefined }))).toBeUndefined();
    expect(endedOf({ kind: "offline" })).toBeUndefined();
  });

  it("gives the element a demo state it would take, and no other", () => {
    expect(demoOf({ opened: 0, hidden: false }, 3)).toEqual({ opened: 0, hidden: false });
    expect(demoOf({ opened: 3, hidden: true }, 3)).toEqual({ opened: 3, hidden: true });
    expect(demoOf({ opened: 4, hidden: true }, 3)).toBeUndefined();
    expect(demoOf({ opened: -1, hidden: true }, 3)).toBeUndefined();
    expect(demoOf({ opened: 1.5, hidden: true }, 3)).toBeUndefined();
    expect(demoOf({ opened: "1", hidden: true }, 3)).toBeUndefined();
    expect(demoOf({ opened: 1, hidden: "no" }, 3)).toBeUndefined();
    expect(demoOf(null, 3)).toBeUndefined();
    expect(demoOf("state", 3)).toBeUndefined();
  });
});
