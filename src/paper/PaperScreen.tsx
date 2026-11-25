// The screen `#/paper`, a task from the learner's paper: the camera; once a photo is taken,
// `FindTasks` on it and the tasks to pick; and once Start has begun them, the screen of solving,
// from which "Add" goes back to the page, and Start begins only the tasks not begun yet. The photo
// goes to api once, to find the tasks, and stays in the tab's memory with the crops cut from it on
// the device; each try of finding is an action of its own, with a key of its own, as api keeps no
// frames for a repeat. A refusal that shuts AI to the learner — the quota, the platform's limit,
// no model admitted, or the own key's limit or refusal — shuts Start: without AI a task from paper
// can't be checked. Retake throws the page away, and the tasks begun with it. The tutor's panel on
// the page takes the learner's request about it, which finds the tasks anew with the frames on the
// page now: the frames it gave take the place of those found, the learner's own
// staying, and Undo puts back the frames before until the learner changes any. Frames found on the
// photo turned upright turn the page's photo the same way before they show, the finding going on
// meanwhile, and the page goes on with the photo turned: its crops, a request and the history take
// it. Start cuts each task's crop, and the crop of the instruction above it where the finding gave
// one, from the same photo. Stop calls a request's finding off while it runs: the frames and the
// page stay as they were, and the request goes back to the field, said so.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useCallback, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { PAPER_TIMEOUT_MS } from "../api/interceptors.ts";
import { idempotencyKey } from "../api/keys.ts";
import { closesAI, outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { IconButton } from "../app/IconButton.tsx";
import { HOME, navigate } from "../app/router.ts";
import { DebugSlot } from "../debug/slot.tsx";
import { watched } from "../debug/watched.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePanelFocus } from "../task/TutorPanel.tsx";
import { Camera } from "./Camera.tsx";
import { cropsOf, type Photo, turnedPhoto } from "./capture.ts";
import { PageTutor } from "./PageTutor.tsx";
import { type BegunTask, type Finding, type PaperPage, usePaper } from "./PaperContext.tsx";
import { type PageSay, Pick } from "./Pick.tsx";
import { asked, foundTasks, framesOf, type PageTask, picked, unturned } from "./page.ts";
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
  /** The learner is of the category adult: the tutor's words of a task offer a report. */
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
  const turn = paper?.turn;
  // The tasks begun on the page as it is now, which an answer that comes later reads.
  const begunNow = useRef(paper?.begun);
  begunNow.current = paper?.begun;
  // The tutor's panel on the page is open.
  const [talking, setTalking] = useState(false);
  const { heading, call } = usePanelFocus(talking);
  // The hand that calls the finding of a request off, by Stop, while it runs.
  const stopper = useRef<AbortController | undefined>(undefined);
  const [stoppable, setStoppable] = useState(false);
  // A request Stop took back, to the field again.
  const [again, setAgain] = useState<
    { readonly text: string; readonly at: number; readonly stopped: true } | undefined
  >(undefined);

  /**
   * FindTasks on the photo; with the learner's request, with the frames of these tasks too, and
   * what the finding came to before it, which Stop gives back.
   */
  const find = useCallback(
    (photo: Photo, request?: string, tasks: readonly PageTask[] = [], before?: Finding) => {
      if (change === undefined || turn === undefined) return;
      const controller = request === undefined ? undefined : new AbortController();
      if (controller !== undefined) {
        stopper.current = controller;
        setStoppable(true);
      }
      const past = () => {
        if (controller === undefined || stopper.current !== controller) return;
        stopper.current = undefined;
        setStoppable(false);
      };
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
            {
              timeoutMs: PAPER_TIMEOUT_MS,
              ...(controller === undefined ? {} : { signal: controller.signal }),
            },
          ),
        undefined,
        request,
      ).then(
        (answer) => {
          past();
          const read = outcomeOf(answer.outcome);
          holder.noteOutcome(profileId, read, ai);
          // A repeat holds no frames: api keeps none, and a new try asks again.
          if (answer.repeated) {
            failed({ kind: "offline" });
            return;
          }
          const updated =
            (found: readonly PageTask[]) =>
            (page: PaperPage): PaperPage => {
              const finding =
                read !== undefined && found.length === 0
                  ? ({ status: "outcome", outcome: read } as const)
                  : ({ status: "found" } as const);
              if (request !== undefined) {
                // None found leaves the page, and Undo, as they were.
                return {
                  ...page,
                  finding,
                  tasks: asked(page.tasks, found, key),
                  before: found.length === 0 ? page.before : page.tasks,
                  talk: [
                    ...page.talk,
                    found.length === 0 ? { kind: "none" } : { kind: "found", count: found.length },
                  ],
                };
              }
              return {
                ...page,
                finding,
                // The frames drawn while it was under way stay.
                tasks: [...found, ...page.tasks.filter((task) => task.drawn)],
              };
            };
          const found = foundTasks(answer);
          const degrees = found.length === 0 ? 0 : answer.turnDegrees;
          if (degrees === 0) {
            change(photo, updated(found));
            return;
          }
          // The photo stays as it is, its frames turned back, where tasks begun on it hold it, in
          // their crops and the history, or where it could not be turned.
          const asIs = () => change(photo, updated(unturned(found, degrees, photo)));
          if (begunNow.current !== undefined) {
            asIs();
            return;
          }
          void turnedPhoto(photo, degrees).then(
            (turned) => turn(photo, turned, degrees, updated(found)),
            asIs,
          );
        },
        (reason: unknown) => {
          past();
          if (controller?.signal.aborted !== true || request === undefined) {
            failed(parseFailure(reason));
            return;
          }
          // Stopped: the page as it was, the request gone from the conversation and in the field.
          change(photo, (page) => {
            const last = page.talk.at(-1);
            const asked = last?.kind === "request" && last.text === request;
            return {
              ...page,
              finding: before ?? { status: "found" },
              talk: asked ? page.talk.slice(0, -1) : page.talk,
            };
          });
          setAgain({ text: request, at: Date.now(), stopped: true });
        },
      );
    },
    [api, change, turn, holder, profileId],
  );

  const page = paper?.page;
  if (paper === undefined) return null;
  const home = () => navigate(HOME);

  if (paper.begun !== undefined && paper.solving && page !== undefined) {
    return (
      <Solve
        profileId={profileId}
        adult={adult}
        tasks={page.tasks}
        begun={paper.begun}
        onKeep={paper.keep}
        onAdd={paper.add}
        onHome={home}
      />
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
    const of = JSON.stringify([page.pageId, ...chosen.map((task) => task.frame)]);
    if (startKey.current?.of !== of) startKey.current = { of, key: idempotencyKey() };
    const key = startKey.current.key;
    setStarting(true);
    setStarted(undefined);
    const photo = page.photo;
    // The instructions' crops after the tasks', in one decoding of the photo.
    const above = chosen.flatMap((task) =>
      task.instruction === undefined ? [] : [task.instruction],
    );
    void cropsOf(photo, [...chosen.map((task) => task.frame), ...above])
      .then(async (cut) => {
        const crops = cut.slice(0, chosen.length);
        let next = chosen.length;
        const instructions = chosen.map((task) =>
          task.instruction === undefined ? undefined : cut[next++],
        );
        const answer = await api.paper.beginPaperAttempts({
          profileId,
          idempotencyKey: key,
          // The same page after "Add": api closes none of its tasks begun before.
          pageId: page.pageId,
          tasks: chosen.length,
          ...holder.routeFields(profileId),
        });
        const begun: BegunTask[] = chosen.flatMap((task, i) => {
          const attemptId = answer.attemptIds[i];
          const crop = crops[i];
          const instruction = instructions[i];
          return attemptId === undefined || crop === undefined
            ? []
            : [
                {
                  attemptId,
                  taskId: task.id,
                  frame: task.frame,
                  drawn: task.drawn,
                  crop,
                  ...(instruction === undefined ? {} : { instruction }),
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

  const says: PageSay[] = [
    ...(finding.status === "outcome"
      ? [
          {
            kind: "fail" as const,
            title: outcomeText(finding.outcome, words),
            // Found nothing, and AI is still open: the way on is a frame by hand.
            line:
              closesAI(finding.outcome) || page.tasks.length > 0
                ? undefined
                : words.text("paper.none-found-how"),
          },
        ]
      : finding.status === "failed"
        ? [
            {
              kind: "fail" as const,
              title: failureText(finding.failure, words),
              action: shuts(finding.failure)
                ? undefined
                : {
                    label: words.text("paper.find-again"),
                    onClick: () => find(page.photo, finding.request, page.tasks),
                  },
            },
          ]
        : []),
    ...(startFailure === undefined
      ? []
      : [{ kind: "fail" as const, title: failureText(startFailure, words) }]),
    ...(closed ? [{ kind: "warn" as const, title: words.text("paper.no-ai") }] : []),
  ];

  const ask = (request: string, voice: boolean) => {
    paper.change(page.photo, (now) => ({
      ...now,
      talk: [...now.talk, { kind: "request", text: request, ...(voice ? { voice } : {}) }],
    }));
    find(page.photo, request, page.tasks, finding);
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
        begun={paper.begun?.map((task) => task.taskId)}
        // Any change of the learner's to the tasks takes Undo away.
        onTasks={(update) =>
          paper.change(page.photo, (now: PaperPage) => ({
            ...now,
            tasks: update(now.tasks),
            before: undefined,
          }))
        }
        says={says}
        none={finding.status === "found"}
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
        // The tutor's button and debug's leave the bar while the panel is open, so that the debug
        // window never opens over it.
        calls={
          talking ? undefined : (
            <>
              <DebugSlot />
              <IconButton
                ref={call}
                value="tutor"
                className="nt-call-tutor"
                aria-expanded={false}
                onClick={() => setTalking(true)}
              />
            </>
          )
        }
      />
      {talking ? (
        <PageTutor
          talk={page.talk}
          busy={finding.status === "finding"}
          closed={closed}
          adult={adult}
          onAsk={ask}
          again={again}
          {...(stoppable ? { onStop: () => stopper.current?.abort() } : {})}
          onUndo={page.before === undefined ? undefined : undo}
          onClose={() => setTalking(false)}
          headingRef={heading}
        />
      ) : null}
    </>
  );
}
