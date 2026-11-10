// The lessons open in memory (R23): what GetAccount named, a run begun in its place, a run ended,
// and what a remount of the same profile finds — the screens' own tests go through App.
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { LessonProvider, useLessons } from "./LessonContext.tsx";

const GAPS = { lessonRunId: "r1", lesson: "m/lesson/gaps", packageDigest: "d1" };
const POSTS = { lessonRunId: "r2", lesson: "m/lesson/posts", packageDigest: "d1" };

function renderLessons(
  learner = create(ProfileSchema, { profileId: "p1", openLessonRuns: [GAPS] }),
) {
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <LessonProvider learner={learner}>{children}</LessonProvider>
  );
  return { learner, ...renderHook(() => useLessons(), { wrapper }) };
}

describe("the lessons open", () => {
  it("start as GetAccount named them, one run for each lesson", () => {
    const { result } = renderLessons();
    expect(result.current?.runs).toEqual([GAPS]);
    expect(result.current?.chosen).toBeUndefined();
    act(() => result.current?.began(POSTS));
    act(() => result.current?.began({ ...GAPS, lessonRunId: "r3" }));
    expect(result.current?.runs).toEqual([POSTS, { ...GAPS, lessonRunId: "r3" }]);
    // A run whose lesson is not known takes no other's place.
    act(() => result.current?.began({ lessonRunId: "r4", lesson: "", packageDigest: "d1" }));
    expect(result.current?.runs).toHaveLength(3);
    act(() => result.current?.choose({ kind: "run", run: POSTS }));
    expect(result.current?.chosen).toEqual({ kind: "run", run: POSTS });
  });

  it("keep what ended for the same profile, and take a new profile's own word", () => {
    const first = renderLessons();
    act(() => first.result.current?.ended("r1"));
    expect(first.result.current?.runs).toEqual([]);
    first.unmount();
    expect(renderLessons(first.learner).result.current?.runs).toEqual([]);
    const fresh = create(ProfileSchema, { profileId: "p1", openLessonRuns: [GAPS] });
    expect(renderLessons(fresh).result.current?.runs).toEqual([GAPS]);
  });

  it("are none outside a provider", () => {
    expect(renderHook(() => useLessons()).result.current).toBeUndefined();
  });
});
