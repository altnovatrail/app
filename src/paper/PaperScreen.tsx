// The screen `#/paper`, a task from the learner's paper (R71): the camera; once a photo is taken,
// `FindTasks` on it and the tasks to pick; and once Start has begun them, the tasks begun. The photo
// goes to api once, to find the tasks, and stays in the tab's memory with the crops cut from it on
// the device; each try of finding is an action of its own, with a key of its own, as api keeps no
// frames for a repeat. A refusal that shuts AI to the learner — the quota, the platform's limit,
// no model admitted, or the own key's limit or refusal — shuts Start: without AI a task from paper
// can't be checked. Retake throws the page away; the tasks begun stay until a new page.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { closesAI, outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { IconButton } from "../app/IconButton.tsx";
import { HOME, navigate } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { Camera } from "./Camera.tsx";
import { cropsOf, type Photo } from "./capture.ts";
import { type BegunTask, type PaperPage, usePaper } from "./PaperContext.tsx";
import { Pick } from "./Pick.tsx";
import { foundTasks, picked } from "./page.ts";

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

export function PaperScreen({ profileId }: { readonly profileId: string }) {
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

  const find = useCallback(
    (photo: Photo) => {
      if (change === undefined) return;
      const ai = holder.aiFields(profileId);
      const failed = (failure: Failure) =>
        change(photo, (page) => ({ ...page, finding: { status: "failed", failure } }));
      change(photo, (page) => ({ ...page, finding: { status: "finding" } }));
      api.paper
        .findTasks({ profileId, idempotencyKey: idempotencyKey(), photo: photo.bytes, ...ai })
        .then(
          (answer) => {
            const read = outcomeOf(answer.outcome);
            holder.noteOutcome(profileId, read, ai);
            // A repeat holds no frames: api keeps none, and a new try asks again.
            if (answer.repeated) {
              failed({ kind: "offline" });
              return;
            }
            const found = foundTasks(answer);
            change(photo, (page) => ({
              ...page,
              finding:
                read !== undefined && found.length === 0
                  ? { status: "outcome", outcome: read }
                  : { status: "found" },
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

  if (paper.begun !== undefined) {
    return <Begun tasks={paper.begun} onHome={home} onAnother={paper.clear} />;
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
    const chosen = picked(page.tasks);
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
            : [{ attemptId, frame: task.frame, crop }];
        });
        if (begun.length !== chosen.length) throw new Error("api began another number of tasks");
        paper.begin(photo, begun);
      })
      .catch((reason: unknown) => setStarted({ photo, failure: parseFailure(reason) }))
      .finally(() => setStarting(false));
  };

  const lines = (
    <>
      {finding.status === "finding" ? (
        <p role="status">{words.text("paper.finding")}</p>
      ) : finding.status === "found" && page.tasks.length === 0 ? (
        <p role="status">{words.text("paper.none-found")}</p>
      ) : finding.status === "outcome" ? (
        <p role="status">
          {outcomeText(finding.outcome, words)}
          {closesAI(finding.outcome) ? null : ` ${words.text("paper.none-found")}`}
        </p>
      ) : finding.status === "failed" ? (
        <p role="alert" className="nt-error">
          {failureText(finding.failure, words)}
          {shuts(finding.failure) ? null : (
            <>
              {" "}
              <button type="button" className="nt-secondary" onClick={() => find(page.photo)}>
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
    </>
  );

  return (
    <Pick
      photo={page.photo}
      tasks={page.tasks}
      onTasks={(update) =>
        paper.change(page.photo, (now: PaperPage) => ({ ...now, tasks: update(now.tasks) }))
      }
      lines={lines}
      finding={finding.status === "finding"}
      closed={closed}
      starting={starting}
      onStart={start}
      onRetake={paper.clear}
      onHome={() => {
        paper.clear();
        home();
      }}
    />
  );
}

/** A task's crop, shown from its own URL while it is on the screen. */
function Crop({ crop, label }: { readonly crop: Blob; readonly label: string }) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    const made = URL.createObjectURL(crop);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [crop]);
  return url === undefined ? null : <img className="nt-crop" src={url} alt={label} />;
}

/**
 * The tasks begun, each its crop, in place of the sheet to solve them on, which this build does not
 * have yet: "Take another page" is a new page.
 */
function Begun({
  tasks,
  onHome,
  onAnother,
}: {
  readonly tasks: readonly BegunTask[];
  readonly onHome: () => void;
  readonly onAnother: () => void;
}) {
  const { words } = useLanguage();
  return (
    <Screen
      title={words.text("paper.begun", { count: tasks.length })}
      layout="task"
      bar={{ back: <IconButton value="back" caption="task.home" onClick={onHome} /> }}
    >
      <p className="nt-hint">{words.text("paper.sheet-later")}</p>
      <ol className="nt-begun">
        {tasks.map((task, i) => (
          <li key={task.attemptId}>
            <Crop crop={task.crop} label={words.text("paper.crop", { n: i + 1 })} />
          </li>
        ))}
      </ol>
      <div className="nt-buttons">
        <button type="button" onClick={onAnother}>
          {words.text("paper.another")}
        </button>
      </div>
    </Screen>
  );
}
