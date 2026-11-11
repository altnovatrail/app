// What an engine's choice gives (R24): a lesson, a task or nothing, and a kind this build does not
// know, or a choice without its ID, as nothing.
import {
  ChoiceKind,
  EngineChoiceSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { givenOf } from "./choice.ts";

const choice = (choiceId: string, kind: ChoiceKind) =>
  create(EngineChoiceSchema, { choiceId, kind });

describe("an engine's choice", () => {
  it("gives a lesson, a task or nothing", () => {
    expect(givenOf(choice("c1", ChoiceKind.LESSON))).toBe("lesson");
    expect(givenOf(choice("c2", ChoiceKind.TASK))).toBe("task");
    expect(givenOf(choice("", ChoiceKind.NOTHING))).toBe("nothing");
  });

  it("is nothing of a kind this build does not know, or with no ID to begin by", () => {
    expect(givenOf(choice("c3", 99 as ChoiceKind))).toBe("nothing");
    expect(givenOf(choice("c4", ChoiceKind.UNSPECIFIED))).toBe("nothing");
    expect(givenOf(choice("", ChoiceKind.TASK))).toBe("nothing");
  });
});
