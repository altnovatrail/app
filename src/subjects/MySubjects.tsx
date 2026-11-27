// Home: the learner's home, in the frame of the row of places. Under its heading, "Home" — the
// pseudonym is the profile's menu's —, "Tasks from my paper" across the width: "Open camera",
// which opens the camera of a new page, "From a file", a photo or a scan of the device to the same
// page to pick the tasks on, and "History", the pages of the solving history; then the modules
// connected, each a card with its title in its own explanation language, the states of its skills
// counted by the rule of skill-map's map, the mark "in order" of a chain, the way to its map, and
// its two ways in (HomeCard.tsx): its lesson and its tasks. There is no card of what comes next:
// each module starts on its own. Solve with an attempt of the module open goes on with it; with an
// attempt of another open, which a choice closes, a question says so first. The tutor time is the
// frame's, its ring at the top right (TutorTime.tsx). The catalog, connecting and the licenses
// are Subjects' (SubjectsPage.tsx), which "All subjects" opens. The legend of the marks stands below
// the cards, on a phone behind a button; that the tutor is an AI is Help's and the tutor's panel's
// of the top right (Shell.tsx). It is drawn as the mockup's `home`.
import type { EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { LESSON, navigate, PAPER, TASK } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type LessonOpen, useLessons } from "../lesson/LessonContext.tsx";
import { givenOf } from "../next/choice.ts";
import { useEngine } from "../next/useEngine.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import { photoOfFile } from "../paper/capture.ts";
import { paperModuleRoute } from "../paper/module.ts";
import { usePaper } from "../paper/PaperContext.tsx";
import { YourPages } from "../paper/YourPages.tsx";
import type { Device } from "../storage/device.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { openTaskOf } from "../task/openTask.ts";
import { HomeCard, ModeShapes } from "./HomeCard.tsx";
import { Legend } from "./Legend.tsx";
import { lessonsRoute } from "./LessonsScreen.tsx";
import { byTitle, type LessonTile, type ModuleCard } from "./modules.ts";
import { useLessonTiles } from "./useLessonTiles.ts";
import { useModules } from "./useModules.ts";

export interface HomeScreenProps {
  /** The modules connected, as cards; none while they come. */
  readonly connected: readonly ModuleCard[] | undefined;
  /** What the lists came to, when they did not answer. */
  readonly failure?: Failure;
  /** Asks for the lists again: offered when the names of some modules did not come. */
  readonly onRetry?: () => void;
  /** Goes on with the lesson a card's tile names. */
  readonly onLesson?: (card: ModuleCard, lesson: LessonTile) => void;
  /** Solve on a card. */
  readonly onSolve?: (card: ModuleCard) => void;
  /** Sets a card's task skill, "" giving the choice back to the tutor. */
  readonly onTaskSkill?: (card: ModuleCard, skill: string) => void;
  /** What a card's way in came to, under its tiles. */
  readonly noteOf?: (card: ModuleCard) => ReactNode;
  /** A photo or a scan of the device chosen by "From a file". */
  readonly onFile?: (file: File) => void;
  /** The file chosen could not be read as a picture. */
  readonly unreadable?: boolean;
  /** "History", the solving history, beside "Open camera". */
  readonly pages?: ReactNode;
}

/** The screen itself, from what its container has read. */
export function HomeScreen({
  connected,
  failure,
  onRetry,
  onLesson,
  onSolve,
  onTaskSkill,
  noteOf,
  onFile,
  unreadable = false,
  pages,
}: HomeScreenProps) {
  const { language, words } = useLanguage();
  const paper = usePaper();
  const paperId = useId();
  const connectedId = useId();
  const picker = useRef<HTMLInputElement>(null);
  const compare = useMemo(() => collator(language).compare, [language]);
  const mine = connected === undefined ? undefined : byTitle(connected, compare);
  const unnamed = connected?.some((card) => card.unnamed === true) === true;
  return (
    <Screen title={words.text("home.screen")} layout="reference" unseen>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      <div className="nt-home-top">
        {/* A new page each time: the camera, whose screen says to keep names out, or a file of the
            device; and beside them the pages of the history. A sheet with a task marked is drawn
            at the right from 600, as the mockup's. */}
        <section aria-labelledby={paperId} className="nt-paper">
          <PaperSheet />
          <p className="nt-paper-eyebrow">
            <Icon value="camera" />
            {words.text("home.camera")}
          </p>
          <h2 id={paperId}>{words.text("subjects.paper")}</h2>
          <p className="nt-paper-sub">{words.text("subjects.paper-sub")}</p>
          {unreadable ? (
            <p role="alert" className="nt-error">
              {words.text("paper.unreadable")}
            </p>
          ) : null}
          <div className="nt-paper-acts">
            <button
              type="button"
              className="nt-icon-text"
              onClick={() => {
                paper?.clear();
                navigate(PAPER);
              }}
            >
              <Icon value="camera" />
              {words.text("subjects.paper-open")}
            </button>
            {onFile === undefined ? null : (
              <>
                <button
                  type="button"
                  className="nt-paper-file nt-icon-text"
                  onClick={() => picker.current?.click()}
                >
                  <Icon value="from-file" />
                  {words.text("home.file")}
                </button>
                <input
                  ref={picker}
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/webp,image/*"
                  hidden
                  tabIndex={-1}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    // The same file picked again is a change too.
                    event.currentTarget.value = "";
                    if (file !== undefined) onFile(file);
                  }}
                />
              </>
            )}
            {pages}
          </div>
        </section>
      </div>
      {unnamed && onRetry !== undefined ? (
        <div role="status">
          <p>{words.text("subjects.unnamed")}</p>
          <button type="button" onClick={onRetry}>
            {words.text("boot.retry")}
          </button>
        </div>
      ) : null}
      <section aria-labelledby={connectedId}>
        {/* Unseen: the cards say what they are, and Subjects is in the bar; the section keeps its name. */}
        <h2 id={connectedId} className="nt-hidden-label">
          {words.text("subjects.title")}
        </h2>
        {mine === undefined ? (
          failure === undefined ? (
            <CardsLoading />
          ) : null
        ) : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-subjects">
            {mine.map((card) => (
              <HomeCard
                key={card.moduleId}
                card={card}
                onLesson={(lesson) => onLesson?.(card, lesson)}
                onLessons={() => navigate(lessonsRoute(card.moduleId))}
                onSolve={() => onSolve?.(card)}
                onTaskSkill={(skill) => onTaskSkill?.(card, skill)}
                note={noteOf?.(card)}
              />
            ))}
          </ul>
        )}
      </section>
      {mine === undefined || mine.length === 0 ? null : <Legend />}
    </Screen>
  );
}

/** Two subjects' cards while they are read, in the cards' own frame. */
function CardsLoading() {
  return (
    <Loading>
      <ul className="nt-subjects" aria-hidden="true">
        {[0, 1].map((n) => (
          <li key={n} className="nt-subject">
            <article>
              <div className="nt-subject-head">
                <Sk width="3rem" height="3rem" radius="0.8125rem" />
                <div className="nt-subject-words nt-loading">
                  <div className="nt-subject-name">
                    <Sk width="13.75rem" height="1.125rem" />
                    <Sk width="6.875rem" height="1.375rem" radius="999px" />
                  </div>
                  <Sk width="10.625rem" height="0.75rem" radius="0.25rem" />
                </div>
                <div className="nt-subject-acts">
                  <Sk width="2.75rem" height="2.75rem" radius="50%" />
                </div>
              </div>
              <Sk width="38%" height="0.5rem" radius="0.1875rem" />
              <div className="nt-ways">
                <ModeShapes />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Loading>
  );
}

/** A page of a book with a task marked on it: a picture of the card, not read out. */
function PaperSheet() {
  return (
    <span className="nt-deco" aria-hidden="true">
      <span className="nt-paper-sheet">
        <i />
        <i />
        <i />
        <span className="nt-sheet-task">
          <i />
          <i />
        </span>
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

/** What a card's way in came to: the question before Solve closes another task, nothing, a failure. */
type Said =
  | { readonly moduleId: string; readonly kind: "confirm" }
  | { readonly moduleId: string; readonly kind: "nothing"; readonly choice: EngineChoice }
  | { readonly moduleId: string; readonly kind: "failure"; readonly failure: Failure };

/** The question before Solve closes the task open: Go on, or Cancel, which gives the focus back. */
function Confirm({ onGo, onCancel }: { readonly onGo: () => void; readonly onCancel: () => void }) {
  const { words } = useLanguage();
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => go.current?.focus(), []);
  return (
    <fieldset className="nt-buttons nt-card-note">
      <legend>{words.text("next.else-confirm")}</legend>
      <button ref={go} type="button" onClick={onGo}>
        {words.text("next.else-go")}
      </button>
      <button type="button" className="nt-secondary" onClick={onCancel}>
        {words.text("common.cancel")}
      </button>
    </fieldset>
  );
}

/** Home of the learner chosen: what api says is connected. */
export function MySubjects({
  profileId,
  device,
}: {
  readonly profileId: string;
  /** The device, whose database the attempt closed goes from; none in a screen's own test. */
  readonly device?: Device;
}) {
  const api = useApi();
  const { views } = usePackages();
  const { words } = useLanguage();
  const open = useAttempt()?.attemptId;
  const lessons = useLessons();
  const paper = usePaper();
  const modules = useModules(profileId, false);
  const connected = useLessonTiles(api, profileId, modules.connected);
  // The module of the attempt open, by which Solve on its card goes on with it.
  const [openModule, setOpenModule] = useState<string | undefined>(undefined);
  useEffect(() => {
    setOpenModule(undefined);
    if (open === undefined) return;
    let current = true;
    openTaskOf(api, views, profileId, open).then(
      (task) => {
        if (current && task.kind === "module") setOpenModule(task.moduleId);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [api, views, profileId, open]);

  const { choose, act } = useEngine(profileId, device);
  const [said, setSaid] = useState<Said | undefined>(undefined);
  const [unreadable, setUnreadable] = useState(false);
  const solving = useRef(false);
  /** The engine's task among the module's alone, closing the attempt `leaving`. */
  const run = useCallback(
    (moduleId: string, leaving: string | undefined) => {
      if (solving.current) return;
      solving.current = true;
      setSaid(undefined);
      void (async () => {
        const given = await choose(moduleId, leaving);
        if (given === undefined) return;
        if (givenOf(given) === "nothing") setSaid({ moduleId, kind: "nothing", choice: given });
        else await act(given, undefined);
      })()
        .catch((reason: unknown) =>
          setSaid({ moduleId, kind: "failure", failure: parseFailure(reason) }),
        )
        .finally(() => {
          solving.current = false;
        });
    },
    [choose, act],
  );

  const onSolve = useCallback(
    (card: ModuleCard) => {
      if (card.sheet === true) navigate(paperModuleRoute(card.moduleId));
      else if (open !== undefined && openModule === card.moduleId) navigate(TASK);
      else if (open !== undefined) setSaid({ moduleId: card.moduleId, kind: "confirm" });
      else run(card.moduleId, undefined);
    },
    [open, openModule, run],
  );

  const onLesson = useCallback(
    (_card: ModuleCard, lesson: LessonTile) => {
      const held = lessons?.runs.find((each) => each.lesson === lesson.lesson);
      const chosen: LessonOpen =
        held === undefined ? { kind: "lesson", lesson: lesson.lesson } : { kind: "run", run: held };
      lessons?.choose(chosen);
      navigate(LESSON);
    },
    [lessons],
  );

  const setTaskSkill = modules.setTaskSkill;
  const onTaskSkill = useCallback(
    (card: ModuleCard, skill: string) => {
      setSaid(undefined);
      setTaskSkill(card.moduleId, skill).catch((reason: unknown) =>
        setSaid({ moduleId: card.moduleId, kind: "failure", failure: parseFailure(reason) }),
      );
    },
    [setTaskSkill],
  );

  const onFile = useCallback(
    (file: File) => {
      setUnreadable(false);
      photoOfFile(file).then(
        (photo) => {
          paper?.takePhoto(photo, true);
          navigate(PAPER);
        },
        () => setUnreadable(true),
      );
    },
    [paper],
  );

  const noteOf = (card: ModuleCard): ReactNode => {
    if (said?.moduleId !== card.moduleId) return null;
    if (said.kind === "confirm") {
      return <Confirm onGo={() => run(card.moduleId, open)} onCancel={() => setSaid(undefined)} />;
    }
    if (said.kind === "failure") {
      return (
        <p role="alert" className="nt-error nt-card-note">
          {failureText(said.failure, words)}
        </p>
      );
    }
    const outcome = outcomeOf(said.choice.outcome);
    // The strings have no full stop of their own: two in one line are two sentences.
    return (
      <p role="status" className="nt-hint nt-card-note">
        {[words.text("next.nothing"), outcome ? outcomeText(outcome, words) : ""]
          .filter((sentence) => sentence !== "")
          .join(". ")}
      </p>
    );
  };

  if (modules.failed !== undefined) {
    return <ReadFailed failure={modules.failed} onRetry={modules.retry} />;
  }
  return (
    <HomeScreen
      connected={connected}
      onRetry={modules.retry}
      onLesson={onLesson}
      onSolve={onSolve}
      onTaskSkill={onTaskSkill}
      noteOf={noteOf}
      onFile={onFile}
      unreadable={unreadable}
      {...(device === undefined
        ? {}
        : { pages: <YourPages profileId={profileId} device={device} /> })}
    />
  );
}
