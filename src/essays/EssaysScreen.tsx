// "My essays", where the learner reads their essays again (R04; R53 in docs/decisions.md; section
// 3.10 of docs/architecture.md): `#/essays`, from My subjects, lists the essays the profile keeps
// on this device, the newest first, each by when it was begun and the first paragraph of its task;
// one opened is read again with the crops it sent, which the list does not read, and shows its task
// and each submission — when it went, the crop of the sheet it sent, what was read and the
// feedback, or why there was none. The server keeps none of it (R87 spec),
// so an essay written on another device is read there. The essay opened is in memory alone, as the
// hash names no attempt (R14): after a reload the list comes again.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HomeWay } from "../app/HomeButton.tsx";
import { Screen } from "../app/Screen.tsx";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { Picture } from "../packages/Picture.tsx";
import type { Device } from "../storage/device.ts";
import { type Essay, type EssaySent, openProfile, type Profile } from "../storage/profile.ts";
import { noteOf } from "../task/essay.ts";

/** The essays of a profile on this device, and its database to open one by: none read yet, or none to read. */
type Read =
  | { readonly profile: Profile | undefined; readonly essays: readonly Essay[] }
  | "failed"
  | undefined;

/** The first paragraph of a task's statement, by which an essay is told from another. */
export function firstParagraph(task: open.Task | undefined): string | undefined {
  return task?.statement.find((part) => part.text !== undefined)?.text;
}

/** A picture's address for as long as it is shown, made and revoked by one effect, as in Picture. */
function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (blob === undefined) return;
    const made = URL.createObjectURL(blob);
    setUrl(made);
    return () => {
      URL.revokeObjectURL(made);
      setUrl(undefined);
    };
  }, [blob]);
  return url;
}

/** One submission of an essay: when it went, the sheet it sent, what was read and the feedback. */
function SentPart({ sent, language }: { readonly sent: EssaySent; readonly language?: string }) {
  const { language: screen, words } = useLanguage();
  const url = useObjectUrl(sent.crop);
  const id = useId();
  const lang = language === undefined ? {} : { lang: language };
  const note = noteOf(sent, words);
  const when = dateTimeFormat(screen, { dateStyle: "medium", timeStyle: "short" });
  return (
    <section aria-labelledby={id} className="nt-card">
      <h3 id={id}>{words.text("essays.sent", { date: when.format(sent.at) })}</h3>
      {url === undefined ? null : (
        <img className="nt-essay-sheet" src={url} alt={words.text("essays.sheet")} />
      )}
      {sent.text === undefined ? null : (
        <>
          <h4>{words.text("essays.text")}</h4>
          <p {...lang}>{sent.text}</p>
        </>
      )}
      <h4>{words.text("essays.feedback")}</h4>
      {note === undefined ? <p {...lang}>{sent.feedback}</p> : <p>{note}</p>}
    </section>
  );
}

/** An essay opened: its task, and each submission in the order they went. */
function EssayView({ essay, onBack }: { readonly essay: Essay; readonly onBack: () => void }) {
  const { language, words } = useLanguage();
  const { files } = usePackages();
  const heading = useRef<HTMLHeadingElement>(null);
  const media = useMemo(() => files.media(essay.digest), [files, essay.digest]);
  const explanation = essay.language;
  useEffect(() => heading.current?.focus(), []);
  const when = dateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
  const lang = explanation === undefined ? {} : { lang: explanation };
  return (
    <>
      <h2 ref={heading} tabIndex={-1}>
        {words.text("device.essay", { date: when.format(essay.startedAt) })}
      </h2>
      <p>{words.text(essay.ended ? "essays.finished" : "essays.not-finished")}</p>
      {essay.task === undefined ? (
        <p>{words.text("essays.withdrawn")}</p>
      ) : (
        <section className="nt-essay-task">
          <h3>{words.text("task.title")}</h3>
          <div {...lang}>
            {essay.task.statement.map((part, i) =>
              part.picture === undefined ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a statement never move.
                <p key={i}>{part.text}</p>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a statement never move.
                <Picture key={i} part={part} media={media} />
              ),
            )}
          </div>
        </section>
      )}
      {essay.sent.length === 0 ? <p>{words.text("essays.not-sent")}</p> : null}
      {essay.sent.map((sent, i) => (
        <SentPart
          // biome-ignore lint/suspicious/noArrayIndexKey: the submissions of an essay never move.
          key={i}
          sent={sent}
          {...(explanation === undefined ? {} : { language: explanation })}
        />
      ))}
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={onBack}>
          {words.text("essays.all")}
        </button>
      </div>
    </>
  );
}

export function EssaysScreen({
  profileId,
  device,
}: {
  readonly profileId: string;
  readonly device: Device;
}) {
  const { language, words } = useLanguage();
  const [read, setRead] = useState<Read>(undefined);
  // The essay opened, read again with its crops; or none, and the list shows.
  const [opened, setOpened] = useState<Essay | undefined>(undefined);
  // The button an essay was opened by takes the focus again on the way back.
  const back = useRef<string | undefined>(undefined);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    let current = true;
    void (async () => {
      const profile = await openProfile(device, profileId);
      return { profile, essays: (await profile?.essays()) ?? [] };
    })().then(
      (found) => {
        if (current) setRead(found);
      },
      () => {
        if (current) setRead("failed");
      },
    );
    return () => {
      current = false;
    };
  }, [device, profileId]);
  useEffect(() => {
    if (opened !== undefined || back.current === undefined) return;
    buttons.current.get(back.current)?.focus();
    back.current = undefined;
  }, [opened]);
  const open = (one: Essay, profile: Profile | undefined) => {
    void (profile?.essay(one.attemptId) ?? Promise.resolve(undefined)).then(
      // An essay erased in another tab meanwhile opens as listed, without its crops.
      (found) => setOpened(found ?? one),
      () => setOpened(one),
    );
  };
  const when = dateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
  return (
    <Screen title={words.text("essays.title")}>
      <HomeWay />
      {read === "failed" ? (
        <p role="alert" className="nt-error">
          {words.text("boot.unreadable")}
        </p>
      ) : read === undefined ? null : opened !== undefined ? (
        <EssayView
          essay={opened}
          onBack={() => {
            back.current = opened.attemptId;
            setOpened(undefined);
          }}
        />
      ) : read.essays.length === 0 ? (
        <p>{words.text("essays.none")}</p>
      ) : (
        <ul className="nt-cards">
          {read.essays.map((one) => {
            const first = firstParagraph(one.task);
            return (
              <li key={one.attemptId} className="nt-card">
                <div className="nt-buttons">
                  <button
                    type="button"
                    ref={(button) => {
                      if (button === null) buttons.current.delete(one.attemptId);
                      else buttons.current.set(one.attemptId, button);
                    }}
                    onClick={() => open(one, read.profile)}
                  >
                    {words.text("essays.open", { date: when.format(one.startedAt) })}
                  </button>
                </div>
                {first === undefined ? null : (
                  <p
                    className="nt-essay-first"
                    {...(one.language === undefined ? {} : { lang: one.language })}
                  >
                    {first}
                  </p>
                )}
                <p>{words.text(one.ended ? "essays.finished" : "essays.not-finished")}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
