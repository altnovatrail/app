// A profile's page in the section for adults (R29 in docs/decisions.md; R05, R07 and R10; sections
// 3.3, 3.5 and 3.8 of docs/architecture.md): what an adult sets of the profile — its pseudonym, its
// default mode, the language of its learner's screens and its voicing — in one form, saved by its
// button with `UpdateProfile` and only the fields that changed. The choices are radio buttons that
// change nothing until Save (WCAG 3.2.2). What another tab changed meanwhile shows in the fields not
// edited here; what is edited here stays until it is saved — an edit made while the request was on
// its way among them. A failure that is the session's own goes to it as well (`onFailed`). Below the
// form, the storage of the profile's works on the server, a consent of its own (R30).
import {
  Mode,
  type Profile,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { pseudonymOf } from "../account/session.ts";
import { changes, formOf, type ProfileForm } from "../account/settings.ts";
import { useApi } from "../api/ApiContext.tsx";
import { ApiError, type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Screen } from "../app/Screen.tsx";
import { languageName } from "../i18n/intl.ts";
import { NAMES } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LANGUAGES, type Language } from "../i18n/language.ts";
import { WorkStorage } from "./WorkStorage.tsx";

/** What the adult changed on the page and has not saved: the pseudonym as typed. */
type Edits = Partial<Omit<ProfileForm, "pseudonym">> & { readonly pseudonym?: string };

/** The edits of `now` that are not the ones sent: those the adult made while the request was away. */
function unsent(now: Edits, sent: Edits): Edits {
  return Object.fromEntries(
    Object.entries(now).filter(([key, value]) => sent[key as keyof Edits] !== value),
  ) as Edits;
}

/** One radio button of a group, its label beside it, 44 × 44 as every target. */
function Option({
  name,
  checked,
  onChange,
  lang,
  children,
}: {
  readonly name: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly lang?: Language;
  readonly children: ReactNode;
}) {
  return (
    <div className="nt-option">
      <label lang={lang}>
        <input type="radio" name={name} checked={checked} onChange={onChange} />
        {children}
      </label>
    </div>
  );
}

export function ProfilePage({
  profile,
  onSaved,
  onFailed,
}: {
  readonly profile: Profile;
  /** api changed the profile: the profile as its answer gives it. */
  readonly onSaved: (profile: Profile) => void;
  /** The request did not go through: the page says why, and the session may move by it. */
  readonly onFailed: (failure: Failure) => void;
}) {
  const api = useApi();
  const { language, words } = useLanguage();
  const id = useId();
  const pseudonymField = useRef<HTMLInputElement>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [pseudonymError, setPseudonymError] = useState(false);
  const [status, setStatus] = useState<"saved" | "unchanged" | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const saved = formOf(profile);
  const pseudonym = edits.pseudonym ?? profile.pseudonym;
  const form: Omit<ProfileForm, "pseudonym"> = {
    defaultMode: edits.defaultMode ?? saved.defaultMode,
    language: edits.language ?? saved.language,
    voicing: edits.voicing ?? saved.voicing,
    speed: edits.speed ?? saved.speed,
  };

  function edit(change: Edits) {
    setEdits((before) => ({ ...before, ...change }));
    setStatus(undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = pseudonymOf(pseudonym);
    setPseudonymError(name === undefined);
    setFailure(undefined);
    setStatus(undefined);
    if (name === undefined) return pseudonymField.current?.focus();
    const settings = changes(profile, { ...form, pseudonym: name });
    if (settings === undefined) return setStatus("unchanged");
    const sent = edits;
    setPending(true);
    try {
      const answer = await api.account.updateProfile({ profileId: profile.profileId, settings });
      if (answer.profile === undefined) throw new ApiError({ kind: "invalid" });
      // What was sent is the profile's now; an edit made since stays an edit.
      setEdits((now) => unsent(now, sent));
      onSaved(answer.profile);
      setStatus("saved");
    } catch (reason) {
      const failed = parseFailure(reason);
      setFailure(failed);
      onFailed(failed);
    } finally {
      setPending(false);
    }
  }

  // The field's language when the build has none of it: none set, or one it does not have.
  const field = profile.interfaceLanguage;
  let unknownName: string | undefined;
  // An empty field is none, as the contract clears it by one.
  if (form.language === undefined && field !== undefined && field !== "") {
    try {
      unknownName = languageName(language, field);
    } catch {
      unknownName = field;
    }
  }

  return (
    <Screen title={words.text("adults.profile", { pseudonym: profile.pseudonym })}>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="nt-field">
          <label htmlFor={`${id}-pseudonym`}>{words.text("profile.pseudonym")}</label>
          <input
            ref={pseudonymField}
            id={`${id}-pseudonym`}
            type="text"
            autoComplete="off"
            value={pseudonym}
            aria-invalid={pseudonymError}
            aria-describedby={
              pseudonymError ? `${id}-pseudonym-hint ${id}-pseudonym-error` : `${id}-pseudonym-hint`
            }
            onChange={(event) => edit({ pseudonym: event.target.value })}
          />
          <p id={`${id}-pseudonym-hint`} className="nt-hint">
            {words.text("profile.pseudonym-hint")}
          </p>
          {pseudonymError ? (
            <p id={`${id}-pseudonym-error`} className="nt-error">
              {words.text("profile.pseudonym-length")}
            </p>
          ) : null}
        </div>
        <fieldset className="nt-choices" aria-describedby={`${id}-mode-hint`}>
          <legend>{words.text("adults.mode")}</legend>
          <Option
            name={`${id}-mode`}
            checked={form.defaultMode === Mode.BY_STEPS}
            onChange={() => edit({ defaultMode: Mode.BY_STEPS })}
          >
            {words.text("task.by-steps")}
          </Option>
          <Option
            name={`${id}-mode`}
            checked={form.defaultMode === Mode.SELF}
            onChange={() => edit({ defaultMode: Mode.SELF })}
          >
            {words.text("task.on-my-own")}
          </Option>
          <p id={`${id}-mode-hint`} className="nt-hint">
            {words.text("adults.mode-hint")}
          </p>
        </fieldset>
        <fieldset
          className="nt-choices"
          aria-describedby={form.language === undefined ? `${id}-language-hint` : undefined}
        >
          <legend>{words.text("adults.language")}</legend>
          {LANGUAGES.map((tag) => (
            <Option
              key={tag}
              name={`${id}-language`}
              lang={tag}
              checked={form.language === tag}
              onChange={() => edit({ language: tag })}
            >
              {NAMES[tag]}
            </Option>
          ))}
          {form.language === undefined ? (
            <p id={`${id}-language-hint`} className="nt-hint">
              {unknownName === undefined
                ? words.text("adults.language-none")
                : words.text("adults.language-unknown", { language: unknownName })}
            </p>
          ) : null}
        </fieldset>
        <fieldset className="nt-choices" aria-describedby={`${id}-voicing-hint`}>
          <legend>{words.text("adults.voicing")}</legend>
          <div className="nt-check">
            <input
              id={`${id}-voicing`}
              type="checkbox"
              checked={form.voicing}
              onChange={(event) => edit({ voicing: event.target.checked })}
            />
            <label htmlFor={`${id}-voicing`}>{words.text("adults.voicing-on")}</label>
          </div>
          <fieldset className="nt-choices">
            <legend>{words.text("adults.speed")}</legend>
            <Option
              name={`${id}-speed`}
              checked={form.speed === VoicingSpeed.NORMAL}
              onChange={() => edit({ speed: VoicingSpeed.NORMAL })}
            >
              {words.text("adults.speed-normal")}
            </Option>
            <Option
              name={`${id}-speed`}
              checked={form.speed === VoicingSpeed.SLOW}
              onChange={() => edit({ speed: VoicingSpeed.SLOW })}
            >
              {words.text("adults.speed-slow")}
            </Option>
          </fieldset>
          <div id={`${id}-voicing-hint`}>
            <p className="nt-hint">{words.text("adults.voicing-later")}</p>
            <p className="nt-hint">{words.text("adults.voicing-reader")}</p>
          </div>
        </fieldset>
        <button type="submit" disabled={pending}>
          {words.text("adults.save")}
        </button>
        <p role="status">{status === undefined ? null : words.text(`adults.${status}`)}</p>
        {failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(failure, words)}
          </p>
        )}
      </form>
      <WorkStorage profile={profile} onSaved={onSaved} onFailed={onFailed} />
    </Screen>
  );
}
