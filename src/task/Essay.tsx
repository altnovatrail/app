// The screen of an open attempt of an essay, a task whose answer slot is bound `sheet` (sections
// 3.2 and 3.3 of docs/architecture.md; R53 in docs/decisions.md; R75, R87 and R127 in spec): what
// Task.tsx read of it, and what the learner does on it, written as it is done. The steps, the
// history of writing and Hint go as on any task (R05, R20, R22). Check sends the crop the canvas
// gives by `SubmitEssay`, with one idempotency key for this work and the same with every repeat of
// it, and the own key or the clock's offset; how the submission ended — feedback, unreadable or
// unchecked —, the text read and the words of the feedback are kept with the essay and its crop,
// which the server keeps none of; while the profile's storage of works is on, the essay goes there
// as every work does, its history, the contexts of its submissions and its picture (T62). The
// attempt stays open: the learner writes the sheet again and
// sends it again, and closes it by Done, open after the first submission, and then the task is
// solved. An attempt api closed is the screen of Task.tsx, and the essay stays on the device. The
// feedback is said by the voicing in the module's language, and "Report a problem" stands at it
// for a learner of the category adult (R33).
import { TutorReply } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  CloseReason,
  type EngineChoice,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { CanvasElement, HistoryChangeEvent, SheetSubmission } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import type { Failure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { outcomeOf } from "../api/outcome.ts";
import { HOME, navigate } from "../app/router.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import { hintPhrases } from "../voice/texts.ts";
import { useWorks } from "../works/useWorks.ts";
import { solutionOf } from "./attempt.ts";
import { EssayScreen, type Finished } from "./EssayScreen.tsx";
import { noteOf, type Shown, sentOf } from "./essay.ts";
import type { HintGiven } from "./Hint.tsx";
import { Pause } from "./pause.ts";
import { unlessClosed, useKeptWork, useOwnVoicing, useStepTechniques } from "./shared.ts";
import {
  givesTechniques,
  goTo,
  gotTechniques,
  type Mode,
  modeOf,
  type StepsState,
  stepDone,
  tick,
} from "./steps.ts";
import type { OpenTaskProps } from "./Task.tsx";

/**
 * The work of a check: its key, the crop as the canvas gave it and as the contract carries it, and
 * the context of the submission with the history's length then, for the work on the server.
 */
interface Sent {
  readonly key: string;
  readonly png: Blob;
  readonly crop: Uint8Array;
  readonly context: SheetSubmission;
  readonly historyLength: number;
}

export function OpenEssay({
  profileId,
  attemptId,
  adult,
  opened,
  again,
  lesson,
  onEnded,
  onClosed,
}: OpenTaskProps) {
  const api = useApi();
  const holder = useKeyHolder();
  const works = useWorks(profileId);
  const { views, files } = usePackages();
  const { language, words } = useLanguage();
  const { auto, prime } = useOwnVoicing();
  const { task, profile, steps } = opened;
  const explanation = opened.manifest?.languages.explanation;
  const element = useRef<CanvasElement>(null);
  const kept = opened.essay?.kept;
  const last = kept?.sent[kept.sent.length - 1];
  const [state, setState] = useState(opened.state);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [blink, setBlink] = useState(false);
  const [hint, setHint] = useState<HintGiven | undefined>(opened.hint);
  // What the last submission came to: the one this device kept, until a check here.
  const [shown, setShown] = useState<Shown | undefined>(last);
  const [came, setCame] = useState(false);
  // How many submissions the attempt has, by api's count and those sent here since.
  const [submissions, setSubmissions] = useState(
    Math.max(opened.essay?.submissions ?? 0, kept?.sent.length ?? 0),
  );
  const [finished, setFinished] = useState<Finished | undefined>(undefined);
  const [choice, setChoice] = useState<EngineChoice | undefined>(undefined);
  // One key for a check of this work, the same with every repeat of it: a new stroke is a new action.
  const sent = useRef<Sent | undefined>(undefined);
  // Once the attempt is over its record is gone: nothing more is written, and no write says unsaved.
  const over = useRef(false);
  const { filled, notSaved, unsavedNow, drawn, keepSteps, keepHistory } = useKeptWork({
    profile,
    attemptId,
    unsaved: opened.unsaved,
    task,
    element,
    over,
  });
  const latest = useRef({ state, filled, finished });
  latest.current = { state, filled, finished };
  const mode = modeOf(state, steps);
  const media = useMemo(() => files.media(opened.digest), [files, opened.digest]);
  const pause = useMemo(
    () =>
      new Pause(setBlink, () => {
        const now = latest.current;
        return now.finished === undefined && now.filled?.[0]?.[0] === true;
      }),
    [],
  );
  useEffect(() => () => pause.stop(), [pause]);

  const save = useCallback(
    (next: StepsState) => {
      setState(next);
      keepSteps(next);
    },
    [keepSteps],
  );

  const closed = useCallback(
    (reason: CloseReason) => {
      over.current = true;
      onClosed(reason);
    },
    [onClosed],
  );

  const place = state.place;
  useStepTechniques({
    api,
    profileId,
    attemptId,
    want:
      mode === "steps" &&
      finished === undefined &&
      givesTechniques(steps[place - 1]) &&
      state.techniques[place] === undefined,
    place,
    onTechniques: useCallback(
      (at: number, ids: readonly string[]) => save(gotTechniques(latest.current.state, at, ids)),
      [save],
    ),
    onClosed: closed,
  });

  const onHistoryChange = useCallback(
    (event: HistoryChangeEvent) => {
      keepHistory(event);
      pause.acted();
      // Another stroke is another action: its check gets a key of its own.
      sent.current = undefined;
    },
    [keepHistory, pause],
  );

  /** The crop of the sheet as it is now, or the one sent before, again. */
  const submission = useCallback(async (): Promise<Sent | undefined> => {
    if (sent.current !== undefined) return sent.current;
    const at = drawn.current;
    const historyLength = element.current?.history.length ?? 0;
    const work = (await element.current?.exportWork()) ?? null;
    if (work === null || !("png" in work)) return undefined;
    const made = {
      key: idempotencyKey(),
      png: work.png,
      crop: new Uint8Array(await work.png.arrayBuffer()),
      context: work.submission,
      historyLength,
    };
    if (drawn.current === at) sent.current = made;
    return made;
  }, [drawn]);

  const check = useCallback(() => {
    // Within the press: the words that come after it may be said (WebKit; section 3.5).
    prime();
    setPending(true);
    setFailure(undefined);
    setCame(false);
    pause.stop();
    void (async () => {
      try {
        const of = await submission();
        if (of === undefined) return;
        setChecking(true);
        const ai = holder.aiFields(profileId);
        const answer = await api.attempt.submitEssay({
          profileId,
          attemptId,
          idempotencyKey: of.key,
          crop: of.crop,
          ...ai,
        });
        sent.current = undefined;
        const outcome = outcomeOf(answer.outcome);
        holder.noteOutcome(profileId, outcome, ai);
        const end = sentOf(answer);
        const now: Shown = { ...end, ...(outcome === undefined ? {} : { outcome }) };
        setShown(now);
        setSubmissions((n) => n + 1);
        setCame(true);
        const { context, historyLength } = of;
        const saved =
          (await profile?.addEssaySubmission(attemptId, of.png, {
            ...end,
            context,
            historyLength,
          })) ?? "unsaved";
        if (saved === "unsaved") unsavedNow();
        // Written to the device, the essay goes to the server too, while the storage is on.
        else if (profile !== undefined) void works.put(profile, attemptId);
        const note = noteOf(now, words);
        auto(
          now.feedback === undefined || note !== undefined
            ? [{ text: note ?? "", language }]
            : [{ text: now.feedback, language: explanation }],
        );
        // api closed the attempt while it went: the feedback came all the same, and stays here.
        if (answer.closed !== CloseReason.UNSPECIFIED) closed(answer.closed);
      } catch (reason) {
        setFailure(unlessClosed(reason, closed));
      } finally {
        setChecking(false);
      }
    })().finally(() => setPending(false));
  }, [
    api,
    holder,
    profileId,
    attemptId,
    profile,
    pause,
    submission,
    unsavedNow,
    words,
    auto,
    language,
    explanation,
    closed,
    prime,
    works,
  ]);

  /** "Hint": api gives the task's techniques and its leading question (R82 in spec). */
  const askHint = useCallback(() => {
    prime();
    setFailure(undefined);
    setPending(true);
    void api.attempt
      .getHint({ profileId, attemptId })
      .then(
        (answer) => {
          if (over.current || answer.hint.case !== "techniques") return;
          const techniques = answer.hint.value.techniqueIds;
          const question = answer.leadingQuestion === "" ? undefined : answer.leadingQuestion;
          setHint({ techniques, ...(question === undefined ? {} : { question }) });
          auto(hintPhrases(task, techniques, question, opened.catalog, explanation));
        },
        (reason: unknown) => setFailure(unlessClosed(reason, closed)),
      )
      .finally(() => setPending(false));
  }, [api, profileId, attemptId, closed, prime, auto, task, opened.catalog, explanation]);

  /** Done: the learner ends the attempt, and the task is solved (R87 in spec). */
  const finish = useCallback(() => {
    setFailure(undefined);
    setPending(true);
    pause.stop();
    void api.attempt
      .done({ profileId, attemptId, ...holder.routeFields(profileId) })
      .then(
        async (answer) => {
          over.current = true;
          let solution: readonly open.StatementPart[] = [];
          try {
            if (answer.solved !== undefined) solution = solutionOf(views, answer.solved);
          } catch {
            // A solution the build cannot read is no reason to hide that the essay is finished.
          }
          await onEnded(CloseReason.DONE, profile);
          setFinished({ criteria: answer.solved?.criteria ?? [], solution });
          lesson?.onNext(answer.next);
          if (answer.next?.next.case === "choice") setChoice(answer.next.next.value);
        },
        (reason: unknown) => setFailure(unlessClosed(reason, closed)),
      )
      .finally(() => setPending(false));
  }, [api, holder, views, profileId, attemptId, profile, pause, onEnded, closed, lesson]);

  const feedback = shown?.feedback;
  const note = shown === undefined ? undefined : noteOf(shown, words);
  const text = shown?.text;

  return (
    <EssayScreen
      task={task}
      manifest={opened.manifest}
      steps={steps}
      catalog={opened.catalog}
      state={state}
      mode={mode}
      filled={filled}
      history={opened.history}
      media={media}
      notSaved={notSaved}
      pending={pending || again.pending}
      checking={checking}
      {...(failure === undefined ? {} : { failure })}
      {...(again.failure === undefined ? {} : { againFailure: again.failure })}
      blink={blink}
      {...(text === undefined ? {} : { text })}
      {...(feedback === undefined || note !== undefined ? {} : { feedback })}
      {...(note === undefined ? {} : { note })}
      came={came}
      {...(adult && feedback !== undefined && note === undefined
        ? {
            report: (
              <ReportProblem
                key={feedback}
                profileId={profileId}
                attemptId={attemptId}
                said={{ text: feedback, reply: TutorReply.ESSAY_FEEDBACK, rung: 0 }}
              />
            ),
          }
        : {})}
      {...(hint === undefined ? {} : { hint })}
      mayFinish={submissions > 0}
      {...(finished === undefined ? {} : { finished })}
      canvasRef={element}
      onHistoryChange={onHistoryChange}
      onMode={(next: Mode) => save({ ...state, mode: next })}
      onGoTo={(to) => save(goTo(state, to))}
      onTick={(chip) => save(tick(state, chip))}
      onDone={() => save(stepDone(state, steps))}
      onCheck={check}
      onHint={askHint}
      onFinish={finish}
      onAgain={again.start}
      onHome={() => navigate(HOME)}
      inLesson={lesson !== undefined}
      next={
        <NextStep
          key={choice?.choiceId ?? "ask"}
          profileId={profileId}
          {...(choice === undefined ? {} : { choice })}
        />
      }
    />
  );
}
