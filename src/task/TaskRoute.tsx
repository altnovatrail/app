// The screen `#/task`: the attempt the learner has open, from memory, on the sheet of a task from
// paper. It shows the last attempt open until the learner leaves it — one begun anew on the sheet
// stays on that sheet, and one begun by "Try it again" or the engine's next task takes its place.
// `GetOpenAttempt` gives the attempt's start — the open view of its task and its package — with
// what api keeps of it: the option tapped by its last submission, its wrong answers and an essay's
// submissions; the screen takes the package's manifest and technique catalog from the shared cache,
// and the history of writing this device keeps from the profile's database. An attempt found closed
// is a screen of its own, with why, "Try it again" and Home, and one closed unchecked asks
// CheckPackages; one api does not know, or with no attempt open, goes home in place of itself, so
// that "back" does not come here again.
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { OpenAttempt } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { failureText } from "../api/words.ts";
import { HomeButton } from "../app/HomeButton.tsx";
import { ProfilePill } from "../app/LearnerMenu.tsx";
import { HOME, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useStorage } from "../boot/Boot.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { isEssay } from "../paper/essay.ts";
import { ModuleSheet, type Opened } from "../paper/ModuleSheet.tsx";
import { SheetLoading } from "../paper/PaperScreen.tsx";
import { choicesOf } from "../solving/attempt.ts";
import { CLOSED_KEYS, closedBy } from "../solving/shared.ts";
import type { Device } from "../storage/device.ts";
import { addProfile, attemptOver, openProfile } from "../storage/profile.ts";
import { useWorks } from "../works/useWorks.ts";
import { useAttempt } from "./AttemptContext.tsx";

export function TaskRoute({
  profileId,
  adult,
}: {
  readonly profileId: string;
  /** Whether the learner is of the category `adult`. */
  readonly adult: boolean;
}) {
  const { device } = useStorage();
  const held = useAttempt();
  const [shown, setShown] = useState(held?.attemptId);
  const setAttempt = held?.setAttempt;
  // The attempt a sheet began anew in its place: the sheet goes on with it.
  const inPlace = useRef<string | undefined>(undefined);
  const onAttempt = useCallback(
    (attemptId: string | undefined, here?: true) => {
      if (here === true) inPlace.current = attemptId;
      setAttempt?.(attemptId);
    },
    [setAttempt],
  );
  // The attempt shown is the last one open: one begun on this screen takes the place of the one
  // that ended, which stays while none is.
  const open = held?.attemptId;
  useEffect(() => {
    if (open !== undefined && open !== inPlace.current) setShown(open);
  }, [open]);
  useEffect(() => {
    if (shown === undefined) redirect(HOME);
  }, [shown]);
  if (shown === undefined) return null;
  return (
    <Task
      key={shown}
      profileId={profileId}
      attemptId={shown}
      adult={adult}
      device={device}
      onAttempt={onAttempt}
    />
  );
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "closed"; readonly reason: CloseReason }
  | { readonly status: "ready"; readonly opened: Opened };

export interface TaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  /** Whether the learner is of the category `adult`. */
  readonly adult: boolean;
  readonly device: Device;
  /**
   * The learner's open attempt changed: a new one began, or this one ended; one begun anew on the
   * sheet, `inPlace`, stays on it.
   */
  readonly onAttempt: (attemptId: string | undefined, inPlace?: true) => void;
}

/** The attempt read, on its sheet, or the screen of what became of it. */
export function Task({ profileId, attemptId, adult, device, onAttempt }: TaskProps) {
  const api = useApi();
  const { views, checks } = usePackages();
  const { words } = useLanguage();
  const works = useWorks(profileId);
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
          await attemptOver(device, profileId, attemptId, { works });
          if (closed === CloseReason.UNCHECKED) void checks.check();
          onAttempt(undefined);
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
      const [manifest, catalog] = await Promise.all([
        views.get(digest, "manifest"),
        views.get(digest, "techniques"),
      ]);
      const profile =
        (await openProfile(device, profileId).catch(() => undefined)) ??
        (await addProfile(device, profileId).catch(() => undefined));
      const stored = await profile?.readAttempt(attemptId).catch(() => undefined);
      const kept = stored?.attempt.digest === digest ? stored : undefined;
      if (profile !== undefined && kept === undefined) {
        await profile.beginAttempt({ attemptId, digest, task });
      }
      return {
        task,
        digest,
        manifest: manifest?.view,
        catalog: catalog?.view,
        profile,
        history: kept?.history ?? [],
        choices: choicesOf(task, answer.items),
        wrongAnswers: answer.wrongAnswers,
        ...(isEssay(task) ? { essay: { submissions: answer.essaySubmissions.length } } : {}),
      };
    }
  }, [api, views, device, profileId, attemptId, attempt]);

  const again = useAgain(profileId, attemptId, onAttempt);

  if (read.status === "loading") return <SheetLoading />;
  if (read.status === "failed") {
    return (
      <>
        <ProfilePill className="nt-home-bar" />
        <ReadFailed failure={read.failure} onRetry={() => setAttempt((n) => n + 1)} home />
      </>
    );
  }
  if (read.status === "closed") {
    // The screen has no bar of the learner: the profile's pill stands above.
    return (
      <>
        <ProfilePill className="nt-home-bar" />
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
            <HomeButton />
          </div>
        </Screen>
      </>
    );
  }
  return (
    <ModuleSheet
      key={read.opened.digest}
      profileId={profileId}
      attemptId={attemptId}
      adult={adult}
      device={device}
      opened={read.opened}
      onAttempt={onAttempt}
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
  const holder = useKeyHolder();
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
        ...holder.routeFields(profileId),
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
  }, [api, holder, profileId, attemptId, onAttempt]);
  return { start, pending, failure };
}
