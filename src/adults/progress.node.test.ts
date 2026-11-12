// What the progress of a profile reads, in Node (R35 in docs/decisions.md): the pages of
// GetProgress by their tokens, the module and local ID of a full ID, how an attempt came out, the
// words of the nine reason codes and of one this build does not know — and that the reason code
// stays the section's: no file of app outside the progress of the section for adults reads it or
// gives it words, so no learner's screen can show it (concepts 12 in spec; R100 in spec).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CloseReason, ReasonCode } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  AttemptRecordSchema,
  ProgressService,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { createApi } from "../api/client.ts";
import { formatHash, parseHash } from "../app/hash.ts";
import { en } from "../i18n/en.ts";
import { ru } from "../i18n/ru.ts";
import {
  CHOICE_REASON_KEYS,
  choiceReasonKey,
  entryOf,
  outcomeKey,
  PROGRESS_PAGE,
  progressMapRoute,
  readProgress,
  skillTitlesOf,
} from "./progress.ts";

describe("the progress's pages", () => {
  it("asks for the first page by an empty token and for the next by the one before's", async () => {
    const asked: string[] = [];
    const api = createApi({
      baseUrl: "https://api.example.org",
      tokens: { token: async () => "t", signOut: async () => {} },
      on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
      sleep: async () => {},
      transport: (interceptors) =>
        createRouterTransport(
          (router: ConnectRouter) =>
            router.service(ProgressService, {
              getProgress(request) {
                asked.push(`${request.profileId} ${request.pageToken}`);
                return request.pageToken === ""
                  ? { attempts: [{ task: "a/b/task/one" }], nextPageToken: "two" }
                  : { attempts: [{ task: "a/b/task/two" }] };
              },
            }),
          { transport: { interceptors } },
        ),
    });
    const first = await readProgress(api, "p1", "");
    const second = await readProgress(api, "p1", first.nextPageToken);
    expect(asked).toEqual(["p1 ", "p1 two"]);
    expect(second.attempts.map((record) => record.task)).toEqual(["a/b/task/two"]);
    expect(second.nextPageToken).toBe("");
  });

  it("lives at #/adults/progress, and a module's map below it by the module's ID", () => {
    expect(formatHash(PROGRESS_PAGE)).toBe("#/adults/progress");
    const hash = formatHash(progressMapRoute("novatrail/olympiad-math"));
    expect(hash).toBe("#/adults/progress/novatrail%2Folympiad-math");
    expect(parseHash(hash).parts).toEqual(["progress", "novatrail/olympiad-math"]);
  });
});

describe("entryOf", () => {
  it("reads the module and the local ID of a full ID of its kind, and nothing else", () => {
    expect(entryOf("novatrail/olympiad-math/task/counting-gaps-3", "task")).toEqual({
      moduleId: "novatrail/olympiad-math",
      local: "counting-gaps-3",
    });
    expect(entryOf("novatrail/olympiad-math/lesson/first", "lesson")?.local).toBe("first");
    expect(entryOf("novatrail/olympiad-math/task/x", "lesson")).toBeUndefined();
    expect(entryOf("not-a-full-id", "task")).toBeUndefined();
    expect(entryOf("a/b/task/", "task")).toBeUndefined();
    expect(entryOf("a/b/task/c/d", "task")).toBeUndefined();
  });
});

describe("outcomeKey", () => {
  const record = (closeReason: CloseReason, wrongAnswers = 0) =>
    create(AttemptRecordSchema, { closeReason, wrongAnswers });

  it("words how an attempt came out, correct with no wrong answer at the first answer", () => {
    expect(outcomeKey(record(CloseReason.CORRECT))).toBe("progress.outcome-first");
    expect(outcomeKey(record(CloseReason.CORRECT, 2))).toBe("progress.outcome-correct");
    expect(outcomeKey(record(CloseReason.UNSPECIFIED))).toBe("progress.outcome-open");
    expect(outcomeKey(record(CloseReason.SOLUTION_SHOWN, 4))).toBe(
      "progress.outcome-solution-shown",
    );
    expect(outcomeKey(record(CloseReason.LEFT))).toBe("progress.outcome-left");
    expect(outcomeKey(record(CloseReason.ABANDONED))).toBe("progress.outcome-abandoned");
    expect(outcomeKey(record(CloseReason.UNCHECKED))).toBe("progress.outcome-unchecked");
    expect(outcomeKey(record(CloseReason.NOT_SUITABLE))).toBe("progress.outcome-not-suitable");
    expect(outcomeKey(record(CloseReason.DONE))).toBe("progress.outcome-done");
    expect(outcomeKey(record(42 as CloseReason))).toBe("common.unknown");
  });
});

describe("skillTitlesOf", () => {
  const record = (closeReason: CloseReason) =>
    create(AttemptRecordSchema, { closeReason, skillTitles: ["Counting gaps", "Posts"] });

  it("names the skills of a solved attempt's task in their order, and of no other attempt", () => {
    for (const solved of [CloseReason.CORRECT, CloseReason.SOLUTION_SHOWN, CloseReason.DONE]) {
      expect(skillTitlesOf(record(solved))).toEqual(["Counting gaps", "Posts"]);
    }
    for (const other of [
      CloseReason.UNSPECIFIED,
      CloseReason.LEFT,
      CloseReason.ABANDONED,
      CloseReason.UNCHECKED,
      CloseReason.NOT_SUITABLE,
      42 as CloseReason,
    ]) {
      expect(skillTitlesOf(record(other))).toEqual([]);
    }
    expect(skillTitlesOf(create(AttemptRecordSchema, { closeReason: CloseReason.DONE }))).toEqual(
      [],
    );
  });
});

describe("the reason codes", () => {
  it("have words of their own for each of the nine, in English and Russian, each different", () => {
    const codes = Object.values(ReasonCode).filter(
      (code): code is ReasonCode => typeof code === "number" && code !== ReasonCode.UNSPECIFIED,
    );
    expect(codes).toHaveLength(9);
    const keys = codes.map((code) => choiceReasonKey(code));
    expect(keys).not.toContain("common.unknown");
    expect(new Set(keys).size).toBe(9);
    for (const dictionary of [en, ru]) {
      expect(new Set(keys.map((key) => dictionary[key])).size).toBe(9);
    }
    expect(Object.keys(CHOICE_REASON_KEYS)).toHaveLength(9);
  });

  it("word a code this build does not know, and none, with the common words, which name no reason", () => {
    expect(choiceReasonKey(99 as ReasonCode)).toBe("common.unknown");
    expect(choiceReasonKey(ReasonCode.UNSPECIFIED)).toBe("common.unknown");
    expect(en["common.unknown"]).toBe("This version of the app doesn't know this yet");
  });
});

/** Every file of the app's code under src/, with its path from src/, tests and helpers aside. */
async function sources(): Promise<{ path: string; text: string }[]> {
  const root = join(import.meta.dirname, "..");
  const found: { path: string; text: string }[] = [];
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      continue;
    }
    const path = join(entry.parentPath, entry.name).slice(root.length + 1);
    if (path.startsWith("test/")) continue;
    found.push({ path, text: await readFile(join(root, path), "utf8") });
  }
  return found;
}

describe("the reason code on the learner's screens", () => {
  it("is never read nor worded outside the progress of the section for adults", async () => {
    const files = await sources();
    expect(files.length).toBeGreaterThan(50);
    const reading = (pattern: RegExp) =>
      files.filter((file) => pattern.test(file.text)).map((file) => file.path);
    // GetProgress, the one answer that carries the code, and the code's field and words.
    expect(reading(/getProgress\b|\breadProgress\b/).sort()).toEqual([
      "adults/ProgressPage.tsx",
      "adults/progress.ts",
    ]);
    expect(
      reading(/\breasonCode\b|\bReasonCode\b|\bchoiceReasonKey\b|\bCHOICE_REASON_KEYS\b/).sort(),
    ).toEqual(["adults/ProgressPage.tsx", "adults/progress.ts"]);
    expect(reading(/progress\.reason-/).sort()).toEqual([
      "adults/progress.ts",
      "i18n/en.ts",
      "i18n/ru.ts",
    ]);
    // And the progress is a page of the section alone.
    expect(reading(/from "[^"]*\/(ProgressPage\.tsx|progress\.ts)"/).sort()).toEqual([
      "adults/AdultSection.tsx",
      "adults/ProfilePage.tsx",
      "adults/ProgressPage.tsx",
    ]);
  });
});
