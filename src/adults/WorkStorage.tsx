// The storage of a profile's works on the server, on the profile's page in the section for adults
// (R30 in docs/decisions.md; R113, R127, R131 and R136 in spec; section 15 of the text of the
// contracts, "The storage of works" and "The versions of the texts"): off unless an adult switched
// it on, as `Profile.work_storage` says. Switching it on is a consent: the text `storage-consent`
// as `GetLegalTexts` gives it in the language of the section, in place, with what R127 in spec has
// the switch say, its next version below it with the day it applies from (R46), and a checkbox
// ticked for the version shown; `SetWorkStorage` names that version — the current one —,
// and a version no longer current reads the text again and asks again, as the invite code does
// (R27). Switching it off goes at once, with no question. While api keeps no copy of a work — and
// the contract has no request that would send one (Д12 api; В53 in RUN.md) — the section says that
// switching on records the consent and the works stay on this device alone, and the page This
// device keeps its warning of their loss.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { ApiError, type Failure, parseFailure, refusedWith } from "../api/failure.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LegalText, NextLegalText } from "../legal/LegalText.tsx";
import { readLegal, STORAGE_TEXT, type Versions, versionsOf } from "../legal/texts.ts";

/** No text: before the first read, and after a failure. */
const NO_TEXT: Versions = { current: undefined, next: undefined };

/**
 * The consent, in place of the button that switches the storage on: the text in force, read when
 * it opens, its next version, and the checkbox that holds for the version it was ticked for. While
 * the text is read again, the one read before stays, so that the checkbox keeps its place.
 */
function Consent({
  profile,
  onSwitchedOn,
  onCancel,
  onFailed,
}: {
  readonly profile: Profile;
  readonly onSwitchedOn: (profile: Profile) => void;
  readonly onCancel: () => void;
  readonly onFailed: (failure: Failure) => void;
}) {
  const api = useApi();
  const { language, words } = useLanguage();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const read = useCallback(
    async (of: Api): Promise<Versions> => versionsOf(await readLegal(of, language), STORAGE_TEXT),
    [language],
  );
  const texts = useRequest(read);
  const before = useRef<Versions>(NO_TEXT);
  if (texts.status === "done") before.current = texts.value;
  const consent =
    texts.status === "failed" ? NO_TEXT : texts.status === "done" ? texts.value : before.current;
  const shown = consent.current;
  // The version the checkbox was ticked for: another version shown unticks it.
  const version = shown === undefined ? "" : `${shown.id} ${shown.version}`;
  const [agreedTo, setAgreedTo] = useState<string | undefined>(undefined);
  const agreed = agreedTo === version;
  const [error, setError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function submit(event: FormEvent) {
    // Until the text is read the button is off, and so is the form's submission by Enter.
    event.preventDefault();
    if (pending) return;
    setFailure(undefined);
    if (!agreed) {
      setError(words.text("storage.agree-needed"));
      return field.current?.focus();
    }
    setError(undefined);
    setPending(true);
    try {
      const answer = await api.account.setWorkStorage({
        profileId: profile.profileId,
        action: Action.ADULT,
        enabled: true,
        // A text with no version in force is named by no request.
        ...(shown === undefined ? {} : { text: { id: shown.id, version: shown.version } }),
      });
      if (answer.profile === undefined) throw new ApiError({ kind: "invalid" });
      onSwitchedOn(answer.profile);
    } catch (reason) {
      const failed = parseFailure(reason);
      if (refusedWith(failed, Cause.TEXT_NOT_CURRENT)) {
        // The current version is read again, and agreed to again once it is shown.
        setAgreedTo(undefined);
        setError(words.text("storage.text-changed"));
        texts.retry();
        field.current?.focus();
      } else {
        setFailure(failed);
        onFailed(failed);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate aria-labelledby={`${id}-title`} onSubmit={(event) => void submit(event)}>
      <h3 id={`${id}-title`} ref={heading} tabIndex={-1}>
        {words.text("storage.consent")}
      </h3>
      {texts.status === "failed" ? (
        <ReadFailure failure={texts.failure} onRetry={texts.retry} />
      ) : null}
      {shown === undefined ? null : <LegalText text={shown} level={4} />}
      {consent.next === undefined ? null : (
        <NextLegalText text={consent.next} current={shown} level={4} />
      )}
      <p id={`${id}-what`}>{words.text("storage.what")}</p>
      <div className="nt-field">
        <div className="nt-check">
          <input
            ref={field}
            id={`${id}-agree`}
            type="checkbox"
            checked={agreed}
            aria-invalid={error !== undefined}
            aria-describedby={error === undefined ? `${id}-what` : `${id}-what ${id}-error`}
            onChange={(event) => {
              setAgreedTo(event.target.checked ? version : undefined);
              // Ticked, the field is right: what it lacked is said no more.
              if (event.target.checked) setError(undefined);
            }}
          />
          <label htmlFor={`${id}-agree`}>{words.text("storage.agree")}</label>
        </div>
        {error === undefined ? null : (
          <p id={`${id}-error`} className="nt-error">
            {error}
          </p>
        )}
      </div>
      <div className="nt-buttons">
        {/* Not disabled while it is under way: a disabled button would drop the focus. */}
        <button type="submit" disabled={texts.status !== "done"} aria-disabled={pending}>
          {words.text("storage.switch-on")}
        </button>
        <button type="button" className="nt-secondary" onClick={onCancel}>
          {words.text("common.cancel")}
        </button>
      </div>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
    </form>
  );
}

export function WorkStorage({
  profile,
  onSaved,
  onFailed,
}: {
  readonly profile: Profile;
  /** api switched the storage: the profile as its answer gives it. */
  readonly onSaved: (profile: Profile) => void;
  /** The request did not go through: the section says why, and the session may move by it. */
  readonly onFailed: (failure: Failure) => void;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [consenting, setConsenting] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  // Each switch done, and the consent left, gives the focus to the button now in place of what went.
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    if (settled > 0) toggle.current?.focus();
  }, [settled]);
  const on = profile.workStorage;
  // Switched on elsewhere — another tab —, the consent open here has nothing left to ask: it goes,
  // and gives the focus to the button now in its place, rather than come back once it is off again.
  useEffect(() => {
    if (on && consenting) {
      setConsenting(false);
      setSettled((n) => n + 1);
    }
  }, [on, consenting]);

  async function switchOff() {
    if (pending) return;
    setFailure(undefined);
    setPending(true);
    try {
      const answer = await api.account.setWorkStorage({
        profileId: profile.profileId,
        action: Action.ADULT,
        enabled: false,
      });
      if (answer.profile === undefined) throw new ApiError({ kind: "invalid" });
      onSaved(answer.profile);
      setSettled((n) => n + 1);
    } catch (reason) {
      const failed = parseFailure(reason);
      setFailure(failed);
      onFailed(failed);
    } finally {
      setPending(false);
    }
  }

  let control: ReactNode;
  if (on) {
    control = (
      <>
        <div className="nt-buttons">
          {/* Not disabled while it is under way: a disabled button would drop the focus. */}
          <button
            ref={toggle}
            type="button"
            className="nt-secondary"
            aria-disabled={pending}
            aria-describedby={`${id}-off`}
            onClick={() => void switchOff()}
          >
            {words.text("storage.switch-off")}
          </button>
        </div>
        <p id={`${id}-off`} className="nt-hint">
          {words.text("storage.off-hint")}
        </p>
      </>
    );
  } else if (consenting) {
    control = (
      <Consent
        profile={profile}
        onSwitchedOn={(changed) => {
          onSaved(changed);
          setConsenting(false);
          setSettled((n) => n + 1);
        }}
        onCancel={() => {
          setConsenting(false);
          setSettled((n) => n + 1);
        }}
        onFailed={onFailed}
      />
    );
  } else {
    control = (
      <div className="nt-buttons">
        <button
          ref={toggle}
          type="button"
          onClick={() => {
            setFailure(undefined);
            setConsenting(true);
          }}
        >
          {words.text("storage.keep")}
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{words.text("storage.title")}</h2>
      <p role="status">{words.text(on ? "storage.on" : "storage.off")}</p>
      {/* While api keeps no copy: switching on records the consent, and no work goes there. */}
      <p>{words.text("storage.not-yet")}</p>
      {control}
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
    </section>
  );
}
