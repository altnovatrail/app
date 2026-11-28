// The lessons of a module (the mockup's `lessons`): `#/lessons/<module>`, from the row of its
// lesson on Home, in the frame of the row of places, a place of Home — "Home" back above the
// heading, "Lessons of the module", the module's tile and title, and how many of its lessons are
// passed. Its lessons by `ListLessons`, in the author's order top to bottom: lessons the order puts
// side by side stand in one group, "In any order", and none bears a number. Each its state — passed,
// begun with its step and a ring, new —, the one Home's tile shows marked "Next"; a tap opens it in
// the player, its open run or else a new run of it. The module's title comes from the manifest of
// its current version, by the list of connected modules; while they come, the shapes of the rows.
import {
  LessonState,
  type ModuleLesson,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { useCallback } from "react";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { Icon } from "../app/Icon.tsx";
import { HOME, LESSON, LESSONS, navigate, type Route, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type LessonOpen, useLessons } from "../lesson/LessonContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { ModuleTile } from "./ModuleTile.tsx";
import { cardOf } from "./modules.ts";

/** The route of a module's lessons. */
export function lessonsRoute(moduleId: string): Route {
  return { screen: LESSONS.screen, parts: [moduleId] };
}

/** The lessons of the order, in its groups: each group the lessons of one place in it. */
export function groupsOf(lessons: readonly ModuleLesson[]): ModuleLesson[][] {
  const groups: ModuleLesson[][] = [];
  for (const lesson of lessons) {
    const last = groups.at(-1);
    if (last !== undefined && last[0]?.group === lesson.group) last.push(lesson);
    else groups.push([lesson]);
  }
  return groups;
}

/** The step of an open run to go on with, from 1: after the last task segment of it that ended. */
function stepOf(lesson: ModuleLesson): number {
  const last = Math.max(0, ...lesson.endedSegments);
  return Math.max(1, Math.min(last + 1, lesson.segments));
}

/** `#/lessons/<module>`: the module's lessons; `#/lessons` alone goes Home in place of itself. */
export function LessonsRoute({
  route,
  profileId,
}: {
  readonly route: Route;
  readonly profileId: string;
}) {
  const moduleId = route.parts[0];
  if (moduleId === undefined || route.parts.length > 1) {
    redirect(HOME);
    return null;
  }
  return <LessonsScreen key={moduleId} profileId={profileId} moduleId={moduleId} />;
}

function LessonsScreen({
  profileId,
  moduleId,
}: {
  readonly profileId: string;
  readonly moduleId: string;
}) {
  const { words } = useLanguage();
  const { views } = usePackages();
  const lessons = useLessons();
  const read = useCallback(
    async (api: Api) => {
      const [list, connected] = await Promise.all([
        api.learning.listLessons({ profileId, moduleId }),
        api.module.listConnectedModules({ profileId }),
      ]);
      const ref = connected.modules.find((module) => module.moduleId === moduleId);
      const card = await cardOf(views, ref ?? { moduleId, packageDigest: "" });
      return { list, card };
    },
    [views, profileId, moduleId],
  );
  const state = useRequest(read);
  const title = words.text("lessons.screen");
  const back = (
    <button
      type="button"
      className="nt-link nt-icon-text nt-back-link"
      onClick={() => navigate(HOME)}
    >
      <Icon value="back" />
      {words.text("nav.home")}
    </button>
  );
  if (state.status === "failed") {
    return <ReadFailed failure={state.failure} onRetry={state.retry} home />;
  }
  const open = (lesson: ModuleLesson) => {
    const held = lessons?.runs.find((each) => each.lesson === lesson.lesson);
    const chosen: LessonOpen =
      held === undefined ? { kind: "lesson", lesson: lesson.lesson } : { kind: "run", run: held };
    lessons?.choose(chosen);
    navigate(LESSON);
  };
  const lang = (card: { language?: string }) =>
    card.language === undefined ? {} : { lang: card.language };
  return (
    <Screen title={title} layout="reference" above={back}>
      {state.status === "loading" ? (
        <Loading className="nt-lessons">
          <span className="nt-lessons-module">
            <Sk width="2rem" height="2rem" radius="0.625rem" />
            <Sk width="12rem" height="1rem" />
          </span>
          <Sk width="16rem" height="0.8125rem" radius="0.25rem" />
          <div className="nt-lessons-list" aria-hidden="true">
            {[0, 1, 2].map((n) => (
              <span key={n} className="nt-lessons-row">
                <Sk width="2.25rem" height="2.25rem" radius="50%" />
                <span className="nt-lessons-words nt-loading">
                  <Sk width="12rem" height="0.9375rem" radius="0.3125rem" />
                  <Sk width="6rem" height="0.8125rem" radius="0.25rem" />
                </span>
              </span>
            ))}
          </div>
        </Loading>
      ) : (
        <div className="nt-lessons">
          <p className="nt-lessons-module">
            <ModuleTile
              moduleId={moduleId}
              title={state.value.card.title}
              className="nt-lessons-tile"
            />
            <span {...lang(state.value.card)}>{state.value.card.title}</span>
          </p>
          <p className="nt-lessons-line">
            {words.text("lessons.line", {
              passed: state.value.list.lessons.filter(
                (lesson) => lesson.state === LessonState.PASSED,
              ).length,
              count: state.value.list.lessons.length,
            })}
          </p>
          {state.value.list.lessons.length === 0 ? (
            <p>{words.text("lessons.none")}</p>
          ) : (
            groupsOf(state.value.list.lessons).map((group, n) => {
              const any = group.length > 1;
              return (
                <section
                  // biome-ignore lint/suspicious/noArrayIndexKey: a group is its place in the order.
                  key={n}
                  className="nt-lessons-group"
                  aria-label={words.text(any ? "lessons.any-order-aria" : "lessons.one")}
                >
                  {any ? (
                    <span className="nt-lessons-any" aria-hidden="true">
                      {words.text("lessons.any-order")}
                    </span>
                  ) : null}
                  <div className="nt-lessons-list">
                    {group.map((lesson) => (
                      <LessonRow
                        key={lesson.lesson}
                        lesson={lesson}
                        next={lesson.lesson === state.value.list.tileLesson}
                        language={state.value.card.language}
                        onOpen={() => open(lesson)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}
    </Screen>
  );
}

/** What a lesson's row shows of its state. */
type RowState = "passed" | "begun" | "new";

/** A lesson's state on its row; one this build does not know is new. */
function rowStateOf(lesson: ModuleLesson): RowState {
  if (lesson.state === LessonState.PASSED) return "passed";
  if (lesson.state === LessonState.OPEN) return "begun";
  return "new";
}

/** The ring of a lesson begun: the share of its steps up to the one to go on with. */
function Ring({ share }: { readonly share: number }) {
  // The ring's circumference, 2π·15, of which the share is drawn.
  const whole = 94.2;
  return (
    <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
      <circle className="nt-ring-track" cx="18" cy="18" r="15" fill="none" strokeWidth="3" />
      <circle
        className="nt-ring-done"
        cx="18"
        cy="18"
        r="15"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(share * whole).toFixed(1)} 100`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

/** A lesson's row: its sign, its title, its state in words, "Next" where Home's tile names it. */
function LessonRow({
  lesson,
  next,
  language,
  onOpen,
}: {
  readonly lesson: ModuleLesson;
  readonly next: boolean;
  readonly language: string | undefined;
  readonly onOpen: () => void;
}) {
  const { words } = useLanguage();
  const state = rowStateOf(lesson);
  const step = stepOf(lesson);
  const sub =
    state === "passed"
      ? words.text("lessons.passed", { count: lesson.segments })
      : state === "begun"
        ? words.text("lessons.step", { step, count: lesson.segments })
        : words.text("lessons.steps", { count: lesson.segments });
  return (
    <button type="button" className="nt-lessons-row" onClick={onOpen}>
      <span className="nt-lessons-sign" data-state={state} aria-hidden="true">
        {state === "passed" ? (
          <Icon value="ticked" />
        ) : state === "begun" ? (
          <Ring share={step / Math.max(1, lesson.segments)} />
        ) : (
          <Icon value="lesson" />
        )}
      </span>
      <span className="nt-lessons-words">
        <span className="nt-lessons-title" {...(language === undefined ? {} : { lang: language })}>
          {lesson.title}
        </span>
        <span className="nt-lessons-sub" data-state={state}>
          {sub}
        </span>
      </span>
      {next ? <span className="nt-lessons-next">{words.text("lessons.next")}</span> : null}
      <span className="nt-lessons-chev" aria-hidden="true">
        <Icon value="more" />
      </span>
    </button>
  );
}
