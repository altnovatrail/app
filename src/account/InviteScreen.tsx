// The invite code of a user with no account, in two steps, as the mockup's `invite` and `agree`:
// the code in four boxes of four characters, and "Back" signing out; then the owner's
// statement of being 18 or older and their acceptance of the privacy policy and the terms
// of use in force, each name a link that opens the text's sheet over the step, whose foot
// leads to its page, and which shows its next version too; the card's foot opens the privacy
// policy's sheet, as the mockup's does. Nothing goes to api before "Create account", which sends the code with the statement and
// the versions in force: a code api does not take brings the first step back with its line. While no
// text is in force there is nothing to accept; while the texts are not read, nothing is sent. The
// acceptance holds for the versions it was given for: other versions read take it back. A step's
// button looks off until its step is given but keeps the focus: pressed, it says what is
// missing and focuses it. What is typed and ticked outlives a visit to the legal pages.
import type { LegalTextRef } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import {
  type FormEvent,
  Fragment,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { RequestState } from "../api/ApiContext.tsx";
import type { Failure } from "../api/failure.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { described } from "../app/described.ts";
import { formatHash } from "../app/hash.ts";
import { Icon } from "../app/Icon.tsx";
import type { Route } from "../app/router.ts";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { Tick } from "../app/Tick.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Phrase } from "../i18n/Phrase.tsx";
import { legalPage } from "../legal/LegalPages.tsx";
import { LegalSheet } from "../legal/LegalSheet.tsx";
import { type Legal, type PageText, refsOf, versionsOf } from "../legal/texts.ts";
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
  /** Opens a text's page, from its sheet. */
  readonly onLegal: (page: Route) => void;
  /** "Back" from the code: the sign-in comes again. */
  readonly onSignOut: () => void;
}

/** The characters of the code as the boxes show them: Crockford's, at most 16. */
const CODE_SHOWN = 16;
const BOX = 4;

/** The four groups of the code as typed: no hyphen, no space, upper case. */
function codeGroups(code: string): string[] {
  const shown = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, CODE_SHOWN);
  return Array.from({ length: CODE_SHOWN / BOX }, (_, group) =>
    shown.slice(group * BOX, group * BOX + BOX),
  );
}

/** Whether the boxes are full: a shorter code is no code api takes. */
function whole(code: string): boolean {
  return codeGroups(code).join("").length === CODE_SHOWN;
}

export function InviteScreen({ texts, draft, onCreate, onLegal, onSignOut }: InviteScreenProps) {
  const { words } = useLanguage();
  const id = useId();
  const codeField = useRef<HTMLInputElement>(null);
  const textsField = useRef<HTMLInputElement>(null);
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
  // The text whose sheet stands over the step: the texts the step has read are its.
  const [sheet, setSheet] = useState<PageText | undefined>(undefined);
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
    if (!whole(code)) {
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

  const sheetShown =
    sheet === undefined ? null : (
      <LegalSheet
        id={sheet}
        versions={
          texts.status === "done"
            ? { status: "done", value: versionsOf(texts.value, sheet), retry: texts.retry }
            : texts
        }
        onClose={() => setSheet(undefined)}
        onPage={onLegal}
      />
    );
  const policy = () => setSheet("privacy-policy");

  if (step === "code") {
    const groups = codeGroups(code);
    const filled = groups.join("").length;
    // The box the next character goes to, the last once the code is whole: the field's focus.
    const nextBox = Math.min(Math.floor(filled / BOX), CODE_SHOWN / BOX - 1);
    return (
      <WelcomeScreen
        key="code"
        over={sheetShown}
        title={words.text("account.invite-title")}
        lead={<BackLink onBack={onSignOut} />}
        onLegal={policy}
      >
        <p className="nt-lead">{words.text("account.invite-intro")}</p>
        <form noValidate onSubmit={next}>
          <div className="nt-field nt-code">
            <label htmlFor={`${id}-code`} className="nt-hidden-label">
              {words.text("account.code-label")}
            </label>
            {/* One field under the boxes: a paste fills them all, and a screen reader hears one field. */}
            <div className="nt-code-boxes">
              <input
                ref={codeField}
                id={`${id}-code`}
                className="nt-code-input"
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
                maxLength={24}
                // The caret the boxes draw stands after the last character, and so does the field's; a
                // selection stays, so that the code can be selected whole and typed or pasted over.
                onSelect={(event) => {
                  const field = event.currentTarget;
                  const end = field.value.length;
                  if (field.selectionStart === field.selectionEnd && field.selectionEnd !== end) {
                    field.setSelectionRange(end, end);
                  }
                }}
                onChange={(event) => {
                  setCode(event.target.value);
                  setCodeError(undefined);
                }}
              />
              <div className="nt-code-shown" aria-hidden="true">
                {groups.map((group, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the four boxes are fixed places.
                  <Fragment key={index}>
                    {index === 0 ? null : <span className="nt-code-sep" />}
                    <span
                      className={index === nextBox ? "nt-code-box nt-code-next" : "nt-code-box"}
                    >
                      {group}
                      {index === nextBox ? <span className="nt-code-caret" /> : null}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
            <p id={`${id}-code-hint`} className="nt-hint">
              {words.text("account.code-hint")}
            </p>
            {codeError === undefined ? null : (
              <p id={`${id}-code-error`} className="nt-error">
                {words.text(`account.${codeError}`)}
              </p>
            )}
          </div>
          <button type="submit" className="nt-main" aria-disabled={!whole(code)}>
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
      over={sheetShown}
      title={words.text("account.agree-title")}
      lead={<BackLink onBack={() => setStep("code")} />}
      onLegal={policy}
    >
      <p className="nt-lead">{words.text("account.agree-intro")}</p>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="nt-ticks">
          <div className="nt-check">
            <Tick>
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
            </Tick>
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
          {shown.length === 0 ? (
            texts.status === "loading" ? (
              <Loading className="nt-check">
                <Sk width="1.5rem" height="1.5rem" radius="50%" style={{ margin: "0.625rem" }} />
                <div className="nt-loading nt-tick-loading">
                  <Sk width="15rem" height="0.9375rem" radius="0.3125rem" />
                  <Sk width="9rem" height="0.9375rem" radius="0.3125rem" />
                </div>
              </Loading>
            ) : null
          ) : (
            <div className="nt-check">
              <Tick>
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
              </Tick>
              <label htmlFor={`${id}-texts`}>
                <Phrase
                  id="account.texts"
                  values={{
                    terms: (
                      <TextLink text="terms-of-use" onOpen={setSheet}>
                        {words.text("account.texts-terms")}
                      </TextLink>
                    ),
                    policy: (
                      <TextLink text="privacy-policy" onOpen={setSheet}>
                        {words.text("account.texts-policy")}
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
        {shown.length === 0 ? null : <p className="nt-hint">{words.text("account.texts-note")}</p>}
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
      </form>
    </WelcomeScreen>
  );
}

/** "Back" at the top of the card, as the mockup's: the step before, or the sign-in. */
function BackLink({ onBack }: { readonly onBack: () => void }) {
  const { words } = useLanguage();
  return (
    <button type="button" className="nt-link nt-back" onClick={onBack}>
      <Icon value="back" />
      {words.text("icon.back")}
    </button>
  );
}

/**
 * A text's name in the checkbox's line, inline in it: a link to its legal page, which opens
 * the text's sheet over the step.
 */
function TextLink({
  text,
  onOpen,
  children,
}: {
  readonly text: PageText;
  readonly onOpen: (page: PageText) => void;
  readonly children: string;
}) {
  return (
    <a
      href={formatHash(legalPage(text))}
      className="nt-inline"
      onClick={(event) => {
        event.preventDefault();
        onOpen(text);
      }}
    >
      {children}
    </a>
  );
}
