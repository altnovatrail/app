// The task screen of an open attempt (sections 3.2 and 3.3 of docs/architecture.md; R05, R20 in
// docs/decisions.md; AttemptService and LearningService in the contract): `GetOpenAttempt` gives
// the attempt's start — the open view of its task and its package — and the screen takes the
// package's manifest, solving steps and technique catalog from the shared cache, and what this
// device wrote of the attempt from the profile's database: the history of writing and the state of
// the steps. Every stroke and every change of the steps is written there, and a write that did not
// land says so. A tap only chooses; Check sends the options tapped, with one idempotency key for the
// action and the same with every repeat of it. "Correct" closes the attempt: its work on the device
// goes, and the solution comes. An attempt api closed meanwhile is a screen of its own, and one
// closed unchecked asks CheckPackages (T21).
import { Mode as ProfileMode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { OpenAttempt } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import type { CanvasElement, HistoryChangeEvent, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { failureText } from "../api/words.ts";
import { HOME, navigate, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { Offline } from "../boot/Screens.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile, type Profile } from "../storage/profile.ts";
import {
  resumed,
  solutionOf,
  tappedChoices,
  type Verdicts,
  verdictsOf,
  withoutSlot,
} from "./attempt.ts";
import { Pause } from "./pause.ts";
import {
  choicesOnly,
  choose,
  givesTechniques,
  goTo,
  gotTechniques,
  type Mode,
  modeOf,
  readState,
  type StepsState,
  slotsFilled,
  stepDone,
  tick,
} from "./steps.ts";
import { TaskScreen } from "./TaskScreen.tsx";

/** Why an attempt is over, in words, by its close reason. */
const CLOSED_KEYS = {
  [CloseReason.CORRECT]: "task.closed-correct",
  [CloseReason.SOLUTION_SHOWN]: "task.closed-solution-shown",
  [CloseReason.LEFT]: "task.closed-left",
  [CloseReason.ABANDONED]: "task.closed-abandoned",
  [CloseReason.UNCHECKED]: "task.unchecked",
  [CloseReason.NOT_SUITABLE]: "task.closed-not-suitable",
  [CloseReason.DONE]: "task.closed-done",
} as const;

/** What the screen has read of the attempt. */
interface Opened {
  readonly task: open.Task;
  readonly digest: string;
  readonly manifest: open.Manifest | undefined;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly profile: Profile | undefined;
  readonly history: readonly HistoryEvent[];
  readonly state: StepsState;
  readonly verdicts: Verdicts;
  /** The first write of the attempt on this device did not land. */
  readonly unsaved: boolean;
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "closed"; readonly reason: CloseReason }
  | { readonly status: "ready"; readonly opened: Opened };

/** The close reason a refusal `CAUSE_ATTEMPT_CLOSED` tells, if it is one. */
function closedBy(failure: Failure): CloseReason | undefined {
  if (failure.kind !== "refused" || failure.cause !== Cause.ATTEMPT_CLOSED) return undefined;
  return failure.data.case === "closeReason" ? failure.data.value : CloseReason.UNSPECIFIED;
}

export interface TaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  /** The profile's default mode, which each attempt starts in. */
  readonly defaultMode: ProfileMode;
  readonly device: Device;
  /** The learner's open attempt changed: a new one began, or this one ended. */
  readonly onAttempt: (attemptId: string | undefined) => void;
}

export function Task({ profileId, attemptId, defaultMode, device, onAttempt }: TaskProps) {
  const api = useApi();
  const { views, checks } = usePackages();
  const { words } = useLanguage();
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the attempt again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    void load().then(
      (opened) => {
        if (current) setRead({ status: "ready", opened });
      },
      async (reason: unknown) => {
        const failure = parseFailure(reason);
        const closed = closedBy(failure);
        if (closed !== undefined) {
          // A read a retry or StrictMode left behind erases nothing: the one that stays does.
          if (!current) return;
          await ended(closed);
          if (current) setRead({ status: "closed", reason: closed });
        } else if (failure.kind === "refused" && failure.cause === Cause.NOT_FOUND) {
          if (!current) return;
          onAttempt(undefined);
          redirect(HOME);
        } else if (current) setRead({ status: "failed", failure });
      },
    );
    return () => {
      current = false;
    };

    async function load(): Promise<Opened> {
      const answer: OpenAttempt | undefined = (
        await api.learning.getOpenAttempt({ profileId, attemptId })
      ).attempt;
      const start = answer?.start;
      if (answer === undefined || start?.task === undefined) {
        throw new Error("api: an open attempt without its start");
      }
      const task = views.parseView(start.task.json, start.task.moduleFormatVersion) as open.Task;
      const digest = start.packageDigest;
      const [manifest, steps, catalog] = await Promise.all([
        views.get(digest, "manifest"),
        views.get(digest, "solving-steps"),
        views.get(digest, "techniques"),
      ]);
      const stepList = steps?.view.steps ?? [];
      const profile =
        (await openProfile(device, profileId).catch(() => undefined)) ??
        (await addProfile(device, profileId).catch(() => undefined));
      const stored = await profile?.readAttempt(attemptId).catch(() => undefined);
      const kept = stored?.attempt.digest === digest ? stored : undefined;
      let unsaved = profile === undefined;
      if (profile !== undefined && kept === undefined) {
        unsaved = (await profile.beginAttempt({ attemptId, digest, task })) === "unsaved";
      }
      const { state, verdicts } = resumed(
        task,
        stepList,
        readState(kept?.attempt.steps),
        answer,
        defaultMode === ProfileMode.SELF ? "self" : "steps",
      );
      return {
        task,
        digest,
        manifest: manifest?.view,
        steps: stepList,
        catalog: catalog?.view,
        profile,
        history: kept?.history ?? [],
        state,
        verdicts,
        unsaved,
      };
    }
  }, [api, views, device, profileId, attemptId, attempt]);

  /**
   * The attempt is over: its work on the device goes, and an unchecked one asks CheckPackages. The
   * screen of an attempt read gives the database it holds; a read that found it closed opens it.
   */
  const ended = useCallback(
    async (reason: CloseReason, held?: Profile) => {
      const profile = held ?? (await openProfile(device, profileId).catch(() => undefined));
      await profile?.attemptEnded(attemptId).catch(() => {});
      if (reason === CloseReason.UNCHECKED) void checks.check();
      onAttempt(undefined);
    },
    [device, profileId, attemptId, checks, onAttempt],
  );

  const again = useAgain(profileId, attemptId, onAttempt);

  if (read.status === "loading") return null;
  if (read.status === "failed") {
    if (read.failure.kind === "offline")
      return <Offline onRetry={() => setAttempt((n) => n + 1)} />;
    return (
      <Screen title={failureText(read.failure, words)}>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          {words.text("boot.retry")}
        </button>
      </Screen>
    );
  }
  if (read.status === "closed") {
    return (
      <Screen title={words.text("api.attempt-closed")}>
        {read.reason === CloseReason.UNSPECIFIED ? null : (
          <p>{words.text(keyFor(CLOSED_KEYS, read.reason))}</p>
        )}
        {again.failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(again.failure, words)}
          </p>
        )}
        <div className="nt-buttons">
          <button
            type="button"
            aria-disabled={again.pending}
            onClick={() => {
              if (!again.pending) again.start();
            }}
          >
            {words.text("task.again")}
          </button>
          <button type="button" className="nt-secondary" onClick={() => navigate(HOME)}>
            {words.text("task.home")}
          </button>
        </div>
      </Screen>
    );
  }
  return (
    <OpenTask
      key={read.opened.digest}
      profileId={profileId}
      attemptId={attemptId}
      opened={read.opened}
      again={again}
      onEnded={ended}
      onClosed={(reason) => {
        void ended(reason, read.opened.profile).then(() => setRead({ status: "closed", reason }));
      }}
    />
  );
}

/** "Try it again": `BeginAttempt` of the same task, with one key until it is done. */
function useAgain(
  profileId: string,
  attemptId: string,
  onAttempt: (attemptId: string | undefined) => void,
) {
  const api = useApi();
  const key = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const start = useCallback(() => {
    key.current ??= idempotencyKey();
    setPending(true);
    setFailure(undefined);
    void api.learning
      .beginAttempt({
        profileId,
        idempotencyKey: key.current,
        start: { case: "previousAttemptId", value: attemptId },
      })
      .then(
        (answer) => {
          key.current = undefined;
          const next = answer.attempt?.attemptId;
          if (next !== undefined) onAttempt(next);
        },
        (reason: unknown) => setFailure(parseFailure(reason)),
      )
      .finally(() => setPending(false));
  }, [api, profileId, attemptId, onAttempt]);
  return { start, pending, failure };
}

interface OpenTaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  readonly opened: Opened;
  readonly again: ReturnType<typeof useAgain>;
  readonly onEnded: (reason: CloseReason, held?: Profile) => Promise<void>;
  readonly onClosed: (reason: CloseReason) => void;
}

/** The screen of an attempt read: what the learner does on it, written as it is done. */
function OpenTask({ profileId, attemptId, opened, again, onEnded, onClosed }: OpenTaskProps) {
  const api = useApi();
  const { views, files } = usePackages();
  const { task, profile, steps } = opened;
  const element = useRef<CanvasElement>(null);
  const [state, setState] = useState(opened.state);
  const [verdicts, setVerdicts] = useState(opened.verdicts);
  const [filled, setFilled] = useState<readonly (readonly boolean[])[] | null>(null);
  const [notSaved, setNotSaved] = useState(opened.unsaved);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [solution, setSolution] = useState<readonly open.StatementPart[] | undefined>(undefined);
  const [blink, setBlink] = useState(false);
  // One key for a check of these options, the same with every repeat of it (section 3.3).
  const key = useRef<string | undefined>(undefined);
  // Once the attempt is over its record is gone: nothing more is written, and no write says unsaved.
  const over = useRef(false);
  const latest = useRef({ state, solution, filled });
  latest.current = { state, solution, filled };
  const mode = modeOf(state, steps);

  const media = useMemo(() => files.media(opened.digest), [files, opened.digest]);
  // Check blinks on a pause only while it is open.
  const pause = useMemo(
    () =>
      new Pause(setBlink, () => {
        const now = latest.current;
        return (
          now.solution === undefined &&
          choicesOnly(task) &&
          slotsFilled(task, now.state.choices, now.filled)
        );
      }),
    [task],
  );
  useEffect(() => () => pause.stop(), [pause]);

  // `filled` changes with no event when the task and the history are given: read it after them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once the element has its task.
  useEffect(() => {
    setFilled(element.current?.filled ?? null);
  }, [task]);

  const save = useCallback(
    (next: StepsState) => {
      setState(next);
      if (over.current) return;
      void profile?.saveSteps(attemptId, next).then((saved) => {
        if (saved === "unsaved") setNotSaved(true);
      });
      if (profile === undefined) setNotSaved(true);
    },
    [profile, attemptId],
  );

  const onHistoryChange = useCallback(
    (event: HistoryChangeEvent) => {
      setFilled(element.current?.filled ?? null);
      pause.acted();
      if (profile === undefined || over.current) return;
      void profile.appendHistory(attemptId, event.detail).then(async (saved) => {
        // Events were missed: the element's whole history takes the place of what was kept.
        const result =
          saved === "missed"
            ? await profile.replaceHistory(attemptId, element.current?.history ?? [])
            : saved;
        if (result === "unsaved") setNotSaved(true);
      });
    },
    [profile, attemptId, pause],
  );

  // A step that gives techniques asks api for them once, by steps, and keeps what it gave.
  const asked = useRef(new Set<number>());
  const place = state.place;
  const step = steps[place - 1];
  const want =
    mode === "steps" &&
    solution === undefined &&
    givesTechniques(step) &&
    state.techniques[place] === undefined;
  useEffect(() => {
    if (!want || asked.current.has(place)) return;
    asked.current.add(place);
    void api.attempt.beginStep({ profileId, attemptId, step: place }).then(
      (answer) =>
        save(gotTechniques(latest.current.state, place, answer.techniques?.techniqueIds ?? [])),
      (reason: unknown) => {
        const closed = closedBy(parseFailure(reason));
        if (closed !== undefined) {
          over.current = true;
          onClosed(closed);
        }
        // Any other failure asks again when the learner comes back to the step.
        else asked.current.delete(place);
      },
    );
  }, [want, place, api, profileId, attemptId, save, onClosed]);

  const check = useCallback(() => {
    key.current ??= idempotencyKey();
    setPending(true);
    setFailure(undefined);
    pause.stop();
    void api.attempt
      .submitWork({
        profileId,
        attemptId,
        idempotencyKey: key.current,
        tappedChoices: tappedChoices(task, latest.current.state.choices),
      })
      .then(
        async (answer) => {
          key.current = undefined;
          setVerdicts(verdictsOf(answer.items));
          if (answer.solved === undefined) {
            save({ ...latest.current.state, wrongAnswers: answer.wrongAnswers });
          } else {
            over.current = true;
            let parts: readonly open.StatementPart[] = [];
            try {
              parts = solutionOf(views, answer.solved);
            } catch {
              // A solution the build cannot read is no reason to hide that the task is solved.
            }
            await onEnded(CloseReason.CORRECT, profile);
            setSolution(parts);
          }
        },
        (reason: unknown) => {
          const found = parseFailure(reason);
          const closed = closedBy(found);
          if (closed === undefined) setFailure(found);
          else {
            over.current = true;
            onClosed(closed);
          }
        },
      )
      .finally(() => setPending(false));
  }, [api, views, profileId, attemptId, task, profile, save, pause, onEnded, onClosed]);

  return (
    <TaskScreen
      task={task}
      manifest={opened.manifest}
      steps={steps}
      catalog={opened.catalog}
      state={state}
      mode={mode}
      verdicts={verdicts}
      filled={filled}
      history={opened.history}
      media={media}
      notSaved={notSaved}
      pending={pending || again.pending}
      {...(failure === undefined ? {} : { failure })}
      {...(solution === undefined ? {} : { solution })}
      {...(again.failure === undefined ? {} : { againFailure: again.failure })}
      blink={blink}
      canvasRef={element}
      onHistoryChange={onHistoryChange}
      onMode={(next: Mode) => save({ ...state, mode: next })}
      onGoTo={(to) => save(goTo(state, to))}
      onTick={(chip) => save(tick(state, chip))}
      onDone={() => save(stepDone(state, steps))}
      onChoose={(slot, option) => {
        // Another option is another action: its check gets a key of its own.
        key.current = undefined;
        setVerdicts((held) => withoutSlot(held, slot));
        save(choose(state, slot, option));
        pause.acted();
      }}
      onCheck={check}
      onAgain={again.start}
      onHome={() => navigate(HOME)}
    />
  );
}
