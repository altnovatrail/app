// The invite code of a user with no account, in two steps, as the mockup's `invite` and `agree`
// (R27, R46, R61): the code, then the owner's statement of being 18 or older (R118 spec) and their
// acceptance of the privacy policy and the terms of use in force, each shown in place below (R131
// spec). Nothing goes to api before "Create account", which sends the code with the statement and
// the versions shown: a code api does not take brings the first step back with its line. While no
// text is in force there is nothing to accept; while the texts are not read, nothing is sent. The
// acceptance holds for the versions it was given for: other versions shown take it back. A text's
// next version shows in place below it, with the day it applies from, and is accepted by no one: a
// consent names the current version (R46). A step's button looks off until its step is given but
// keeps the focus (R20): pressed, it says what is missing and focuses it. What is typed and ticked
// outlives a visit to the legal pages.
import type { LegalTextRef } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { type FormEvent, type RefObject, useEffect, useId, useRef, useState } from "react";
import type { RequestState } from "../api/ApiContext.tsx";
import type { Failure } from "../api/failure.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { described } from "../app/described.ts";
import { Icon } from "../app/Icon.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Phrase } from "../i18n/Phrase.tsx";
import { LegalText, NextLegalText } from "../legal/LegalText.tsx";
import { ACCOUNT_TEXTS, type Legal, refsOf, type Versions, versionsOf } from "../legal/texts.ts";
import { WelcomeScreen } from "../signin/Welcome.tsx";
import { FormFailure } from "./FormFailure.tsx";

/** The legal texts as a read gives them: read, being read, or a failure with its retry. */
export type TextsRead = RequestState<Legal> & { readonly retry: () => void };

/** No text: before the first read, and after a failure. */
const NO_TEXTS: Legal = { texts: [], next: [] };

/** What the owner typed and ticked, kept while the legal pages stand in the screen's place. */
export interface InviteDraft {
  readonly step: "code" | "agree";
  readonly code: string;
  readonly adult: boolean;
  readonly acceptedFor: string | undefined;
}

export interface InviteScreenProps {
  readonly texts: TextsRead;
  /** Where the draft is kept beyond the screen, and read back from when it comes again. */
  readonly draft?: RefObject<InviteDraft | undefined>;
  readonly onCreate: (
    code: string,
    accepted: readonly Pick<LegalTextRef, "id" | "version">[],
  ) => Promise<"done" | "code-not-accepted" | "text-not-current" | Failure>;
  /** Opens the legal pages. */
  readonly onLegal: () => void;
}

export function InviteScreen({ texts, draft, onCreate, onLegal }: InviteScreenProps) {
  const { words } = useLanguage();
  const id = useId();
  const codeField = useRef<HTMLInputElement>(null);
  const textsField = useRef<HTMLInputElement>(null);
  const shownTexts = useRef(new Map<string, HTMLElement>());
  // While the texts are read anew, those read before stay, so that the checkbox keeps its place.
  const before = useRef<Legal>(NO_TEXTS);
  if (texts.status === "done") before.current = texts.value;
  const legal =
    texts.status === "failed" ? NO_TEXTS : texts.status === "done" ? texts.value : before.current;
  const shown = legal.texts;
  const kept = draft?.current;
  const adultField = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"code" | "agree">(kept?.step ?? "code");
  const [code, setCode] = useState(kept?.code ?? "");
  const [adult, setAdult] = useState(kept?.adult ?? false);
  // The versions the owner ticked the checkbox for, as one key: other versions shown are unticked.
  const versions = refsOf(shown)
    .map(({ id: text, version }) => `${text} ${version}`)
    .join(" ");
  const [acceptedFor, setAcceptedFor] = useState<string | undefined>(kept?.acceptedFor);
  const accepted = acceptedFor === versions;
  const [codeError, setCodeError] = useState<"code-needed" | "code-not-accepted" | undefined>(
    undefined,
  );
  const [adultError, setAdultError] = useState(false);
  const [textsError, setTextsError] = useState<"texts-needed" | "texts-changed" | undefined>(
    undefined,
  );
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const given = adult && (shown.length === 0 || accepted);
  useEffect(() => {
    if (draft !== undefined) draft.current = { step, code, adult, acceptedFor };
  }, [draft, step, code, adult, acceptedFor]);
  // The code api did not take: its field takes the focus once its step is back, after the heading.
  useEffect(() => {
    if (step === "code" && codeError === "code-not-accepted") codeField.current?.focus();
  }, [step, codeError]);

  function next(event: FormEvent) {
    event.preventDefault();
    if (code.trim() === "") {
      setCodeError("code-needed");
      codeField.current?.focus();
      return;
    }
    setCodeError(undefined);
    setStep("agree");
  }

  async function submit(event: FormEvent) {
    // Until the texts are read the button is off, and so is Enter.
    event.preventDefault();
    if (pending || texts.status !== "done") return;
    const noTexts = shown.length > 0 && !accepted;
    setAdultError(!adult);
    setTextsError(noTexts ? "texts-needed" : undefined);
    setFailure(undefined);
    if (!adult) return adultField.current?.focus();
    if (noTexts) return textsField.current?.focus();
    setPending(true);
    const result = await onCreate(code.trim(), refsOf(shown));
    setPending(false);
    if (result === "code-not-accepted") {
      setCodeError("code-not-accepted");
      setStep("code");
    } else if (result === "text-not-current") {
      // The current versions are read again, and accepted again once they are shown.
      setAcceptedFor(undefined);
      setTextsError("texts-changed");
      texts.retry();
      textsField.current?.focus();
    } else if (result !== "done") {
      setFailure(result);
    }
  }

  /** A text's place below, which a link of the checkbox's line scrolls to and focuses. */
  function showText(text: string) {
    const place = shownTexts.current.get(text);
    place?.scrollIntoView({ block: "start" });
    place?.focus({ preventScroll: true });
  }

  if (step === "code") {
    return (
      <WelcomeScreen key="code" title={words.text("account.invite-title")} onLegal={onLegal}>
        <p className="nt-lead">{words.text("account.invite-intro")}</p>
        <form noValidate onSubmit={next}>
          <div className="nt-field nt-code">
            <label htmlFor={`${id}-code`} className="nt-hidden-label">
              {words.text("account.invite-title")}
            </label>
            <input
              ref={codeField}
              id={`${id}-code`}
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              aria-invalid={codeError !== undefined}
              aria-describedby={described(
                `${id}-code-hint`,
                codeError !== undefined && `${id}-code-error`,
              )}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeError(undefined);
              }}
            />
            <p id={`${id}-code-hint`} className="nt-hint">
              {words.text("account.code-hint")}
            </p>
            {codeError === undefined ? null : (
              <p id={`${id}-code-error`} className="nt-error">
                {words.text(`account.${codeError}`)}
              </p>
            )}
          </div>
          <button type="submit" className="nt-main" aria-disabled={code.trim() === ""}>
            {words.text("account.next")}
          </button>
        </form>
        <p className="nt-signed">
          <Icon value="ticked" />
          {words.text("account.signed-in")}
        </p>
      </WelcomeScreen>
    );
  }

  return (
    <WelcomeScreen
      key="agree"
      title={words.text("account.agree-title")}
      lead={
        <button type="button" className="nt-link nt-back" onClick={() => setStep("code")}>
          <Icon value="back" />
          {words.text("icon.back")}
        </button>
      }
      onLegal={onLegal}
    >
      <p className="nt-lead">{words.text("account.agree-intro")}</p>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="nt-ticks">
          <div className="nt-check">
            <input
              ref={adultField}
              id={`${id}-adult`}
              type="checkbox"
              checked={adult}
              aria-invalid={adultError}
              aria-describedby={described(`${id}-adult-line`, adultError && `${id}-adult-error`)}
              onChange={(event) => {
                setAdult(event.target.checked);
                setAdultError(false);
              }}
            />
            <div>
              <label htmlFor={`${id}-adult`} className="nt-tick-title">
                {words.text("account.adult")}
              </label>
              <p id={`${id}-adult-line`} className="nt-hint">
                {words.text("account.adult-line")}
              </p>
              {adultError ? (
                <p id={`${id}-adult-error`} className="nt-error">
                  {words.text("account.adult-needed")}
                </p>
              ) : null}
            </div>
          </div>
          {/* A next version alone, before its day, is accepted by no one: no checkbox for it. */}
          {shown.length === 0 ? null : (
            <div className="nt-check">
              <input
                ref={textsField}
                id={`${id}-texts`}
                type="checkbox"
                checked={accepted}
                aria-invalid={textsError !== undefined}
                aria-describedby={described(textsError !== undefined && `${id}-texts-error`)}
                onChange={(event) => {
                  setAcceptedFor(event.target.checked ? versions : undefined);
                  setTextsError(undefined);
                }}
              />
              <label htmlFor={`${id}-texts`}>
                <Phrase
                  id="account.texts"
                  values={{
                    policy: (
                      <TextLink
                        to={`${id}-privacy-policy`}
                        onShow={() => showText("privacy-policy")}
                      >
                        {words.text("account.texts-policy")}
                      </TextLink>
                    ),
                    terms: (
                      <TextLink to={`${id}-terms-of-use`} onShow={() => showText("terms-of-use")}>
                        {words.text("account.texts-terms")}
                      </TextLink>
                    ),
                  }}
                />
              </label>
            </div>
          )}
        </div>
        {textsError !== undefined && shown.length > 0 ? (
          <p id={`${id}-texts-error`} className="nt-error">
            {words.text(`account.${textsError}`)}
          </p>
        ) : null}
        {shown.length === 0 ? null : (
          <p className="nt-hint">{words.text("legal.english-in-force")}</p>
        )}
        {texts.status === "failed" ? (
          <ReadFailure failure={texts.failure} onRetry={texts.retry} />
        ) : null}
        <button
          type="submit"
          className="nt-main"
          disabled={pending || texts.status !== "done"}
          aria-disabled={!given}
        >
          {words.text("account.create")}
        </button>
        {/* api has texts in force that the screen did not get to show: said all the same. */}
        {shown.length === 0 && textsError === "texts-changed" ? (
          <p role="alert" className="nt-error">
            {words.text("account.texts-changed")}
          </p>
        ) : null}
        <FormFailure failure={failure} />
        {shown.length === 0 && legal.next.length === 0 ? null : (
          <section className="nt-account-texts" aria-labelledby={`${id}-texts-title`}>
            <h2 id={`${id}-texts-title`}>{words.text("account.texts-title")}</h2>
            {ACCOUNT_TEXTS.map((text) => (
              <div
                key={text}
                id={`${id}-${text}`}
                tabIndex={-1}
                ref={(place) => {
                  if (place === null) shownTexts.current.delete(text);
                  else shownTexts.current.set(text, place);
                }}
              >
                <AccountText {...versionsOf(legal, text)} />
              </div>
            ))}
          </section>
        )}
      </form>
    </WelcomeScreen>
  );
}

/**
 * A text's name in the checkbox's line, inline in it: a link down to the text the line accepts,
 * which takes the focus there too.
 */
function TextLink({
  to,
  onShow,
  children,
}: {
  readonly to: string;
  readonly onShow: () => void;
  readonly children: string;
}) {
  return (
    <a
      href={`#${to}`}
      className="nt-inline"
      onClick={(event) => {
        event.preventDefault();
        onShow();
      }}
    >
      {children}
    </a>
  );
}

/** A text of the account below the ticks: its current version, then its next one. */
function AccountText({ current, next }: Versions) {
  return (
    <>
      {current === undefined ? null : <LegalText text={current} level={3} />}
      {next === undefined ? null : <NextLegalText text={next} current={current} level={3} />}
    </>
  );
}
