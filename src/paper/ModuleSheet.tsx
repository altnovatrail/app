// A task of a module the engine gave, solved on the sheet of a task from paper — the screen of
// solving itself, with one task and no counter: its statement the module's text and its items'
// drawn as a picture, its pictures from the module's media under it, and on the tracing paper the options of
// its slot bound `choice`, of which the screen holds the one tapped. Its history and each Check's
// context go to the profile's database as the attempt's, and to the server by `PutWork` while the
// storage of works is on; a Check after Correct begins the same task anew on the same sheet. Once
// it is solved, Next task goes to what the answer said comes next, or asks the engine again in the
// module's task skill; the pill at the top right chooses that skill. An essay, a task with a
// rubric, is one too, on a lined sheet, its submissions' contexts kept as any Check's.
import type { Next } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { HistoryChangeEvent, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { HOME, navigate } from "../app/router.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { givenOf } from "../next/choice.ts";
import { useEngine } from "../next/useEngine.ts";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { slotKey } from "../solving/attempt.ts";
import type { Device } from "../storage/device.ts";
import { attemptOver, type Profile } from "../storage/profile.ts";
import { SkillPill } from "../subjects/SkillPick.tsx";
import { useModules } from "../subjects/useModules.ts";
import { useWorks } from "../works/useWorks.ts";
import { rowFrame } from "./module.ts";
import { choiceSlotOf, chosenOf, statementPiecesOf, writesOn } from "./moduleTask.ts";
import { SheetLoading } from "./PaperScreen.tsx";
import type { PageTask } from "./page.ts";
import { Solve } from "./Solve.tsx";
import type { BegunTask } from "./solve.ts";
import { statementPictureOf } from "./statement.ts";

/** What the screen read of the attempt the sheet opens. */
export interface Opened {
  readonly task: open.Task;
  readonly digest: string;
  readonly manifest: open.Manifest | undefined;
  readonly catalog: open.Techniques | undefined;
  readonly profile: Profile | undefined;
  /** The history of writing this device keeps of the attempt. */
  readonly history: readonly HistoryEvent[];
  /** The options its last submission tapped, by slot key, as api keeps them. */
  readonly choices: Readonly<Record<string, string>>;
  /** Its wrong answers, as api counts them. */
  readonly wrongAnswers: number;
  /** Of an essay: how many submissions api counts. */
  readonly essay?: { readonly submissions: number };
}

/** The one task of the sheet, by the key the screen of solving knows it by. */
const TASK_ID = "module";
const TASKS: readonly PageTask[] = [
  { id: TASK_ID, frame: rowFrame(0), drawn: false, picked: true },
];

export function ModuleSheet({
  profileId,
  attemptId,
  adult,
  device,
  opened,
  onAttempt,
}: {
  readonly profileId: string;
  readonly attemptId: string;
  readonly adult: boolean;
  readonly device: Device;
  readonly opened: Opened;
  /** The learner's open attempt changed: one begun anew on this sheet, `inPlace`, stays on it. */
  readonly onAttempt: (attemptId: string | undefined, inPlace?: true) => void;
}) {
  const api = useApi();
  const holder = useKeyHolder();
  const { files } = usePackages();
  const { words } = useLanguage();
  const works = useWorks(profileId);
  const engine = useEngine(profileId, device);
  const modules = useModules(profileId, false);
  const { task, manifest, profile } = opened;
  const moduleId = manifest?.id;
  const choice = useMemo(() => choiceSlotOf(task), [task]);
  const [begun, setBegun] = useState<readonly BegunTask[] | undefined>(undefined);
  const [next, setNext] = useState<EngineChoice | undefined>(undefined);
  const [nexting, setNexting] = useState(false);
  const [nextNote, setNextNote] = useState<string | undefined>(undefined);
  // The attempt the history goes to: the latest, also while React has not drawn it yet.
  const current = useRef(attemptId);
  const renewKey = useRef<string | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the sheet is drawn once, as it opens.
  useEffect(() => {
    let live = true;
    void statementPiecesOf(task, files.media(opened.digest))
      .then(statementPictureOf)
      .then((crop) => {
        if (!live) return;
        const tapped =
          choice === undefined ? undefined : opened.choices[slotKey(choice.item, choice.slot)];
        const chosen = chosenOf(choice, tapped);
        setBegun([
          {
            attemptId,
            taskId: TASK_ID,
            frame: rowFrame(0),
            drawn: false,
            crop,
            history: opened.history,
            wrongAnswers: opened.wrongAnswers,
            ...(chosen === undefined ? {} : { chosen }),
          },
        ]);
      });
    return () => {
      live = false;
    };
  }, []);

  /** The task changed: each Check answered sends its context once, the device keeping it too. */
  const keep = useCallback(
    (_taskId: string, update: (task: BegunTask) => BegunTask) =>
      setBegun((before) => {
        const was = before?.[0];
        if (was === undefined) return before;
        const now = update(was);
        const sent = now.sent ?? [];
        for (const each of sent.slice((was.sent ?? []).length)) {
          void profile
            ?.addSubmission(now.attemptId, each.context, each.historyLength)
            .then(() => works.put(profile, now.attemptId))
            .catch(() => {});
        }
        return [now];
      }),
    [profile, works],
  );

  const onHistory = useCallback(
    (event: HistoryChangeEvent) => {
      if (profile === undefined) return;
      const at = current.current;
      const sheet = event.target as { readonly history?: BegunTask["history"] } | null;
      void profile
        .appendHistory(at, event.detail)
        .then((saved) =>
          saved === "missed" ? profile.replaceHistory(at, sheet?.history ?? []) : saved,
        );
    },
    [profile],
  );

  /** Begun anew after its attempt closed: the same task, on the same sheet, with its work. */
  const renew = useCallback(
    async (was: BegunTask): Promise<string> => {
      renewKey.current ??= idempotencyKey();
      const answer = await api.learning.beginAttempt({
        profileId,
        idempotencyKey: renewKey.current,
        start: { case: "previousAttemptId", value: was.attemptId },
        ...holder.routeFields(profileId),
      });
      renewKey.current = undefined;
      const now = answer.attempt?.attemptId;
      if (now === undefined || now === "") throw new Error("api began no attempt");
      current.current = now;
      if (profile !== undefined) {
        await profile.beginAttempt({ attemptId: now, digest: opened.digest, task }).catch(() => {});
        await profile.replaceHistory(now, was.history).catch(() => {});
      }
      setBegun((before) =>
        before?.map(({ over: _, sent: __, ...rest }) => ({ ...rest, attemptId: now })),
      );
      setNext(undefined);
      setNextNote(undefined);
      onAttempt(now, true);
      return now;
    },
    [api, holder, profileId, profile, opened.digest, task, onAttempt],
  );

  /** Solved: the attempt is over, its work off the device and on the server while the storage is on. */
  const solved = useCallback(
    (comes: Next | undefined) => {
      if (comes?.next.case === "choice") setNext(comes.next.value);
      void attemptOver(device, profileId, current.current, {
        ...(profile === undefined ? {} : { held: profile }),
        works,
      }).then(() => onAttempt(undefined));
    },
    [device, profileId, profile, works, onAttempt],
  );

  /** Next task: the one the answer named, or the engine's again in the task skill. */
  const onNext = useCallback(() => {
    if (nexting || moduleId === undefined) return;
    setNexting(true);
    setNextNote(undefined);
    void (async () => {
      try {
        if (next !== undefined && givenOf(next) !== "nothing")
          return await engine.act(next, undefined);
        const given = await engine.choose(moduleId, undefined);
        if (given === undefined || givenOf(given) === "nothing") {
          const outcome = given === undefined ? undefined : outcomeOf(given.outcome);
          setNext(undefined);
          setNextNote(
            [words.text("next.nothing"), outcome === undefined ? "" : outcomeText(outcome, words)]
              .filter((part) => part !== "")
              .join(". "),
          );
          return;
        }
        await engine.act(given, undefined);
      } catch (reason) {
        setNextNote(failureText(parseFailure(reason), words));
      } finally {
        setNexting(false);
      }
    })();
  }, [nexting, moduleId, next, engine, words]);

  const card = modules.connected?.find((each) => each.moduleId === moduleId);
  const { setTaskSkill } = modules;
  const onTaskSkill = useCallback(
    (skill: string) => {
      if (moduleId === undefined) return;
      setNextNote(undefined);
      setTaskSkill(moduleId, skill).then(
        // The task Next task asks for is one of the skill chosen now.
        () => setNext(undefined),
        (reason: unknown) => setNextNote(failureText(parseFailure(reason), words)),
      );
    },
    [moduleId, setTaskSkill, words],
  );

  if (begun === undefined) return <SheetLoading />;
  return (
    <Solve
      profileId={profileId}
      adult={adult}
      tasks={TASKS}
      begun={begun}
      onKeep={keep}
      onRenew={renew}
      onHome={() => navigate(HOME)}
      onHistory={onHistory}
      module={{
        task,
        ...(choice === undefined ? {} : { choice }),
        writes: writesOn(task),
        language: manifest?.languages.explanation,
        catalog: opened.catalog,
        pill: <SkillPill card={card} onTaskSkill={onTaskSkill} />,
        essay: opened.essay,
        onSolved: solved,
        onNext,
        nexting,
        nextNote,
      }}
    />
  );
}
