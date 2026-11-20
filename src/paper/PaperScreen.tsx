// The screen `#/paper`, a task from the learner's paper (R71): the camera; once a photo is taken,
// `FindTasks` on it and the tasks to pick; and once Start has begun them, the screen of solving,
// from which "Add" goes back to the page, and Start begins only the tasks not begun yet. The photo
// goes to api once, to find the tasks, and stays in the tab's memory with the crops cut from it on
// the device; each try of finding is an action of its own, with a key of its own, as api keeps no
// frames for a repeat. A refusal that shuts AI to the learner — the quota, the platform's limit,
// no model admitted, or the own key's limit or refusal — shuts Start: without AI a task from paper
// can't be checked. Retake throws the page away, and the tasks begun with it. The tutor's panel on
// the page takes the learner's request about it, which finds the tasks anew with the frames on the
// page now (R74; R165 spec): the frames it gave take the place of those found, the learner's own
// staying, and Undo puts back the frames before until the learner changes any.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useCallback, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { PAPER_TIMEOUT_MS } from "../api/interceptors.ts";
import { idempotencyKey } from "../api/keys.ts";
import { closesAI, outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { HOME, navigate } from "../app/router.ts";
import { DebugSlot } from "../debug/slot.tsx";
import { watched } from "../debug/watched.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { TutorButton, usePanelFocus } from "../task/TutorPanel.tsx";
import { Camera } from "./Camera.tsx";
import { cropsOf, type Photo } from "./capture.ts";
import { PageTutor } from "./PageTutor.tsx";
import { type BegunTask, type PaperPage, usePaper } from "./PaperContext.tsx";
import { Pick } from "./Pick.tsx";
import { asked, foundTasks, framesOf, limit, MAX_TASKS, type PageTask, picked } from "./page.ts";
import { Solve } from "./Solve.tsx";
import { notBegun } from "./solve.ts";

/** The refusals that shut AI to the learner beyond the call, as the outcomes of `closesAI`. */
const SHUTTING: ReadonlySet<Cause> = new Set([
  Cause.QUOTA,
  Cause.PLATFORM_LIMIT,
  Cause.NOT_ADMITTED,
  Cause.LIMIT_REACHED,
  Cause.KEY_REFUSED,
]);

function shuts(failure: Failure | undefined): boolean {
  return failure?.kind === "refused" && SHUTTING.has(failure.cause);
}

export function PaperScreen({
  profileId,
  adult,
}: {
  readonly profileId: string;
  /** The learner is of the category adult: the tutor's words of a task offer a report (R33). */
  readonly adult: boolean;
}) {
  const paper = usePaper();
  const api = useApi();
  const holder = useKeyHolder();
  const { words } = useLanguage();
  const [starting, setStarting] = useState(false);
  // What Start came to, on the photo it was pressed on.
  const [started, setStarted] = useState<
    { readonly photo: Photo; readonly failure: Failure } | undefined
  >(undefined);
  // The key of Start, kept while the photo and the tasks picked are the same, so that a press
  // again repeats it.
  const startKey = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);
  const change = paper?.change;
  // The tutor's panel on the page is open.
  const [talking, setTalking] = useState(false);
  const { heading, call } = usePanelFocus(talking);

  /** FindTasks on the photo; with the learner's request, with the frames of these tasks too. */
  const find = useCallback(
    (photo: Photo, request?: string, tasks: readonly PageTask[] = []) => {
      if (change === undefined) return;
      const ai = holder.aiFields(profileId);
      const failed = (failure: Failure) =>
        change(photo, (page) => ({ ...page, finding: { status: "failed", failure, request } }));
      change(photo, (page) => ({ ...page, finding: { status: "finding" } }));
      const frames = request === undefined ? undefined : framesOf(tasks);
      const key = idempotencyKey();
      watched(
        api,
        () =>
          api.paper.findTasks(
            {
              profileId,
              idempotencyKey: key,
              photo: photo.bytes,
              ...(frames === undefined
                ? {}
                : {
                    request,
                    found: frames.found.map((box) => ({ box })),
                    drawn: frames.drawn.map((box) => ({ box })),
                  }),
              ...ai,
            },
            { timeoutMs: PAPER_TIMEOUT_MS },
          ),
        undefined,
        request,
      ).then(
        (answer) => {
          const read = outcomeOf(answer.outcome);
          holder.noteOutcome(profileId, read, ai);
          // A repeat holds no frames: api keeps none, and a new try asks again.
          if (answer.repeated) {
            failed({ kind: "offline" });
            return;
          }
          const found = foundTasks(answer);
          const finding =
            read !== undefined && found.length === 0
              ? ({ status: "outcome", outcome: read } as const)
              : ({ status: "found" } as const);
          if (request !== undefined) {
            // None found leaves the page, and Undo, as they were.
            change(photo, (page) => ({
              ...page,
              finding,
              tasks: asked(page.tasks, found, key),
              before: found.length === 0 ? page.before : page.tasks,
              talk: [
                ...page.talk,
                found.length === 0 ? { kind: "none" } : { kind: "found", count: found.length },
              ],
            }));
            return;
          }
          change(photo, (page) => ({
            ...page,
            finding,
            // The frames drawn while it was under way stay.
            tasks: [...found, ...page.tasks.filter((task) => task.drawn)],
          }));
        },
        (reason: unknown) => failed(parseFailure(reason)),
      );
    },
    [api, change, holder, profileId],
  );

  const page = paper?.page;
  if (paper === undefined) return null;
  const home = () => navigate(HOME);

  if (paper.begun !== undefined && paper.solving && page !== undefined) {
    return (
      <>
        <Solve
          profileId={profileId}
          adult={adult}
          tasks={page.tasks}
          begun={paper.begun}
          onKeep={paper.keep}
          onAdd={paper.add}
          onHome={home}
        />
        <DebugSlot above />
      </>
    );
  }
  if (page === undefined) {
    return (
      <Camera
        onPhoto={(photo) => {
          paper.takePhoto(photo);
          find(photo);
        }}
        onClose={home}
      />
    );
  }

  const { finding } = page;
  const startFailure = started?.photo === page.photo ? started.failure : undefined;
  const closed =
    (finding.status === "outcome" && closesAI(finding.outcome)) ||
    (finding.status === "failed" && shuts(finding.failure)) ||
    shuts(startFailure);

  const start = () => {
    const chosen = notBegun(page.tasks, paper.begun);
    // Each task picked is begun already: solving goes on.
    if (chosen.length === 0 && picked(page.tasks).length > 0) {
      paper.begin(page.photo, []);
      return;
    }
    const of = JSON.stringify([page.photo.url, ...chosen.map((task) => task.frame)]);
    if (startKey.current?.of !== of) startKey.current = { of, key: idempotencyKey() };
    const key = startKey.current.key;
    setStarting(true);
    setStarted(undefined);
    const photo = page.photo;
    void cropsOf(
      photo,
      chosen.map((task) => task.frame),
    )
      .then(async (crops) => {
        const answer = await api.paper.beginPaperAttempts({
          profileId,
          idempotencyKey: key,
          tasks: chosen.length,
          ...holder.routeFields(profileId),
        });
        const begun: BegunTask[] = chosen.flatMap((task, i) => {
          const attemptId = answer.attemptIds[i];
          const crop = crops[i];
          return attemptId === undefined || crop === undefined
            ? []
            : [
                {
                  attemptId,
                  taskId: task.id,
                  frame: task.frame,
                  drawn: task.drawn,
                  crop,
                  history: [],
                },
              ];
        });
        if (begun.length !== chosen.length) throw new Error("api began another number of tasks");
        paper.begin(photo, begun);
      })
      .catch((reason: unknown) => setStarted({ photo, failure: parseFailure(reason) }))
      .finally(() => setStarting(false));
  };

  const over = limit(page.tasks);
  const limitLine =
    over === "too-many" ? "paper.too-many" : over === "at-most" ? "paper.at-most" : undefined;
  const lines = (
    <>
      {finding.status === "finding" ? (
        <p role="status">{words.text("paper.finding")}</p>
      ) : finding.status === "found" && page.tasks.length === 0 ? (
        <p role="status">{words.text("paper.none-found")}</p>
      ) : finding.status === "outcome" ? (
        <p role="status">
          {outcomeText(finding.outcome, words)}
          {closesAI(finding.outcome) || page.tasks.length > 0
            ? null
            : ` ${words.text("paper.none-found")}`}
        </p>
      ) : finding.status === "failed" ? (
        <p role="alert" className="nt-error">
          {failureText(finding.failure, words)}
          {shuts(finding.failure) ? null : (
            <>
              {" "}
              <button
                type="button"
                className="nt-secondary"
                onClick={() => find(page.photo, finding.request, page.tasks)}
              >
                {words.text("paper.find-again")}
              </button>
            </>
          )}
        </p>
      ) : null}
      {startFailure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(startFailure, words)}
        </p>
      )}
      {closed ? <p className="nt-hint">{words.text("paper.no-ai")}</p> : null}
      {limitLine === undefined ? null : (
        <p role="status" className="nt-hint">
          {words.text(limitLine, { max: MAX_TASKS })}
        </p>
      )}
    </>
  );

  const ask = (request: string) => {
    paper.change(page.photo, (now) => ({
      ...now,
      talk: [...now.talk, { kind: "request", text: request }],
    }));
    find(page.photo, request, page.tasks);
  };
  const undo = () =>
    paper.change(page.photo, (now) =>
      now.before === undefined
        ? now
        : { ...now, tasks: now.before, before: undefined, talk: [...now.talk, { kind: "undone" }] },
    );

  return (
    <>
      <Pick
        photo={page.photo}
        tasks={page.tasks}
        // Any change of the learner's to the tasks takes Undo away.
        onTasks={(update) =>
          paper.change(page.photo, (now: PaperPage) => ({
            ...now,
            tasks: update(now.tasks),
            before: undefined,
          }))
        }
        lines={lines}
        finding={finding.status === "finding"}
        closed={closed}
        starting={starting}
        onStart={start}
        onRetake={paper.clear}
        onHome={() => {
          // Back from the page "Add" opened keeps the tasks begun, and their work, for the way back.
          if (paper.begun === undefined) paper.clear();
          home();
        }}
        beside={talking}
      />
      {talking ? (
        <PageTutor
          talk={page.talk}
          busy={finding.status === "finding"}
          closed={closed}
          onAsk={ask}
          onUndo={page.before === undefined ? undefined : undo}
          onClose={() => setTalking(false)}
          headingRef={heading}
        />
      ) : (
        <TutorButton onOpen={() => setTalking(true)} buttonRef={call} />
      )}
      <DebugSlot above />
    </>
  );
}
