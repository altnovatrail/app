// The way into the app (sections 3.2, 3.6 and 3.10 of docs/architecture.md; R19 in
// docs/decisions.md): the sign-in, the invite code of a user with no account with the legal texts it
// accepts (R27), the owner's own profile, the choice of the learner and the sign-out, each a screen
// of its own in the language of the device. The app below it opens only once a learner is chosen,
// so that nothing of it opens before the device has erased what an account other than the one api
// names left there. The section for adults opens from the choice of the learner and from the bar
// above the learner's screens, in place of either, while the account is open (R29); a profile it
// changes, the other tabs hear of by BroadcastChannel, and a change they tell of comes here. The
// legal pages show at any step, before signing in too, from the sign-in screen and from the
// section's first page, and their bar goes back to where they were opened from (R31).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import type {
  LegalText as LegalTextOf,
  LegalTextRef,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AdultSection } from "../adults/AdultSection.tsx";
import { type RequestState, useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { failureText } from "../api/words.ts";
import { ADULTS, HOME, LEGAL, navigate, type Route, useRoute } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useDeployment, useStorage } from "../boot/Boot.tsx";
import { Offline, StorageGone } from "../boot/Screens.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LegalPages } from "../legal/LegalPages.tsx";
import { LegalText } from "../legal/LegalText.tsx";
import { accountTexts, readTexts, refsOf } from "../legal/texts.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import { useSignIn } from "../signin/SignInContext.tsx";
import { SignInScreen } from "../signin/SignInScreen.tsx";
import { siteStorage } from "../storage/browser.ts";
import type { Device } from "../storage/device.ts";
import { countryNames } from "./countries.ts";
import { pseudonymOf, Session, type Unfinished, unfinishedWork } from "./session.ts";
import { PROFILES_CHANNEL, profileMessage, profileOf } from "./settings.ts";

/** The learner chosen, and what the bar above the learner's screens does. */
export interface Learner {
  readonly learner: Profile;
  readonly switchLearner: () => void;
  readonly signOut: () => void;
}

const LearnerContext = createContext<Learner | undefined>(undefined);

export const LearnerProvider = LearnerContext.Provider;

/** The learner chosen; none outside the gate, as in a screen's own test. */
export function useLearner(): Learner | undefined {
  return useContext(LearnerContext);
}

export function AccountGate({ children }: { readonly children: ReactNode }) {
  const api = useApi();
  const { device } = useStorage();
  const service = useSignIn();
  const { checks } = usePackages();
  const { signIn } = useDeployment();
  const { projectId, apiKey } = signIn;
  const session = useMemo(
    () => new Session({ api, device, service, project: { projectId, apiKey }, checks }),
    [api, device, service, projectId, apiKey, checks],
  );
  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);
  const { language, words } = useLanguage();
  const route = useRoute();
  // Where the legal pages' bar goes back to: home, unless the section opened them. Memory alone,
  // as the profile the section chose: after a reload, home.
  const [legalBack, setLegalBack] = useState<Route>(HOME);
  const openLegal = useCallback((back: Route) => {
    setLegalBack(back);
    navigate(LEGAL);
  }, []);
  // One channel for the tab, which tells the others of a profile api changed here and hears theirs.
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const opened = new BroadcastChannel(PROFILES_CHANNEL);
    opened.onmessage = (event: MessageEvent) => {
      const changed = profileOf(event.data);
      if (changed !== undefined) session.profileChanged(changed);
    };
    channel.current = opened;
    return () => {
      channel.current = undefined;
      opened.close();
    };
  }, [session]);
  const open = state.step === "choose" || state.step === "learning";
  // The sign-out screen is for the account open when it was asked: once that has gone some other
  // way — another tab signed out, the account is gone — the next account does not open on it.
  useEffect(() => {
    if (!open) setLeaving(false);
  }, [open]);

  if (leaving && open) {
    return (
      <SignOutScreen
        device={device}
        profiles={state.account.profiles}
        onCancel={() => setLeaving(false)}
        onConfirm={async () => {
          const done = await session.signOut();
          if (done === "failed") return "failed";
          setLeft(done === "left");
          setLeaving(false);
          return done;
        }}
      />
    );
  }
  // Back to the section only while its account is open: once it has gone, home.
  if (route.screen === LEGAL.screen) {
    return <LegalPages route={route} back={open ? legalBack : HOME} />;
  }
  if (open && route.screen === ADULTS.screen) {
    return (
      <AdultSection
        route={route}
        device={device}
        profiles={state.account.profiles}
        onSaved={(changed) => {
          session.profileChanged(changed);
          channel.current?.postMessage(profileMessage(changed));
        }}
        onFailed={(failure) => session.profileFailed(failure)}
        onEraseAll={async () => {
          const done = await session.signOut(true);
          if (done === "failed") return "failed";
          // The sign-in comes next, and after it home, not the page of a device erased.
          setLeft(done === "left");
          navigate(HOME);
          return done;
        }}
        onLegal={() => openLegal(ADULTS)}
      />
    );
  }
  switch (state.step) {
    case "starting":
    case "loading":
      return null;
    case "signed-out":
      return (
        <SignInScreen
          onSignIn={async () => {
            setLeft(false);
            return session.signIn();
          }}
          {...(state.result === undefined ? {} : { result: state.result })}
          left={left}
          onLegal={() => openLegal(HOME)}
        />
      );
    case "offline":
      return <Offline onRetry={() => void session.load()} />;
    case "unreadable":
      return <StorageGone trouble="unreadable" />;
    case "held":
      return (
        <Screen title={words.text("account.held")}>
          <button type="button" onClick={() => void session.load()}>
            {words.text("boot.retry")}
          </button>
        </Screen>
      );
    case "failed":
      return (
        <Screen title={failureText(state.failure, words)}>
          <button type="button" onClick={() => void session.load()}>
            {words.text("boot.retry")}
          </button>
        </Screen>
      );
    case "invite":
      return <InviteStep session={session} />;
    case "owner-profile":
      return (
        <OwnerProfileScreen
          onCreate={(pseudonym, country) =>
            session.createOwnerProfile(pseudonym, country, language)
          }
        />
      );
    case "choose":
      return (
        <ChooseScreen
          profiles={[state.owner]}
          first={state.first}
          onChoose={() => session.choose()}
          onSignOut={() => setLeaving(true)}
        />
      );
    case "learning":
      return (
        <LearnerProvider
          value={{
            learner: state.learner,
            switchLearner: () => session.switchLearner(),
            signOut: () => setLeaving(true),
          }}
        >
          {children}
        </LearnerProvider>
      );
  }
}

/** A failure a form shows below its button. */
function FormFailure({ failure }: { readonly failure: Failure | undefined }) {
  const { words } = useLanguage();
  return failure === undefined ? null : (
    <p role="alert" className="nt-error">
      {failureText(failure, words)}
    </p>
  );
}

/** The ID of a field's hint and error, as `aria-describedby` names them. */
function described(...ids: (string | false)[]): string | undefined {
  const named = ids.filter((id): id is string => id !== false);
  return named.length === 0 ? undefined : named.join(" ");
}

/** The legal texts of the account, read in the language of the screen, and the screen with them. */
function InviteStep({ session }: { readonly session: Session }) {
  const { language } = useLanguage();
  const read = useCallback(
    async (api: Api) => accountTexts(await readTexts(api, language)),
    [language],
  );
  const texts = useRequest(read);
  return (
    <InviteScreen
      texts={texts}
      onCreate={(code, accepted) => session.createAccount(code, accepted)}
    />
  );
}

/** The legal texts as a read gives them: read, being read, or a failure with its retry. */
export type TextsRead = RequestState<readonly LegalTextOf[]> & { readonly retry: () => void };

/**
 * The invite code, the owner's statement of being 18 or older (R118 in spec), and their acceptance
 * of the privacy policy and the terms of use in force, each open in place (R131 in spec; R27). While
 * none is in force there is nothing to accept; while the texts are not read, nothing is sent. The
 * acceptance holds for the versions it was given for: other versions shown take it back.
 */
export function InviteScreen({
  texts,
  onCreate,
}: {
  readonly texts: TextsRead;
  readonly onCreate: (
    code: string,
    accepted: readonly Pick<LegalTextRef, "id" | "version">[],
  ) => Promise<"done" | "code-not-accepted" | "text-not-current" | Failure>;
}) {
  const { words } = useLanguage();
  const id = useId();
  const codeField = useRef<HTMLInputElement>(null);
  const adultField = useRef<HTMLInputElement>(null);
  const textsField = useRef<HTMLInputElement>(null);
  // While the texts are read anew, those read before stay, so that the checkbox keeps its place.
  const before = useRef<readonly LegalTextOf[]>([]);
  if (texts.status === "done") before.current = texts.value;
  const shown =
    texts.status === "failed" ? [] : texts.status === "done" ? texts.value : before.current;
  const [code, setCode] = useState("");
  const [adult, setAdult] = useState(false);
  // The versions the owner ticked the checkbox for, as one key: other versions shown are unticked.
  const versions = refsOf(shown)
    .map(({ id: text, version }) => `${text} ${version}`)
    .join(" ");
  const [acceptedFor, setAcceptedFor] = useState<string | undefined>(undefined);
  const accepted = acceptedFor === versions;
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [adultError, setAdultError] = useState(false);
  const [textsError, setTextsError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    // Until the texts are read the button is off, and so is the form's submission by Enter.
    event.preventDefault();
    const noCode = code.trim() === "" ? words.text("account.code-needed") : undefined;
    const noTexts = shown.length > 0 && !accepted ? words.text("account.texts-needed") : undefined;
    setCodeError(noCode);
    setAdultError(!adult);
    setTextsError(noTexts);
    setFailure(undefined);
    if (noCode !== undefined) return codeField.current?.focus();
    if (!adult) return adultField.current?.focus();
    if (noTexts !== undefined) return textsField.current?.focus();
    setPending(true);
    const result = await onCreate(code.trim(), refsOf(shown));
    setPending(false);
    if (result === "code-not-accepted") {
      setCodeError(words.text("account.code-not-accepted"));
      codeField.current?.focus();
    } else if (result === "text-not-current") {
      // The current versions are read again, and accepted again once they are shown.
      setAcceptedFor(undefined);
      setTextsError(words.text("account.texts-changed"));
      texts.retry();
      textsField.current?.focus();
    } else if (result !== "done") {
      setFailure(result);
    }
  }

  return (
    <Screen title={words.text("account.invite-title")}>
      <p>{words.text("account.invite-intro")}</p>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="nt-field">
          <label htmlFor={`${id}-code`}>{words.text("account.invite-title")}</label>
          <input
            ref={codeField}
            id={`${id}-code`}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            aria-invalid={codeError !== undefined}
            aria-describedby={described(codeError !== undefined && `${id}-code-error`)}
            onChange={(event) => setCode(event.target.value)}
          />
          {codeError === undefined ? null : (
            <p id={`${id}-code-error`} className="nt-error">
              {codeError}
            </p>
          )}
        </div>
        <div className="nt-field">
          <div className="nt-check">
            <input
              ref={adultField}
              id={`${id}-adult`}
              type="checkbox"
              checked={adult}
              aria-invalid={adultError}
              aria-describedby={described(adultError && `${id}-adult-error`)}
              onChange={(event) => setAdult(event.target.checked)}
            />
            <label htmlFor={`${id}-adult`}>{words.text("account.adult")}</label>
          </div>
          {adultError ? (
            <p id={`${id}-adult-error`} className="nt-error">
              {words.text("account.adult-needed")}
            </p>
          ) : null}
        </div>
        {texts.status === "failed" ? (
          <ReadFailure failure={texts.failure} onRetry={texts.retry} />
        ) : null}
        {shown.length === 0 ? null : (
          <div className="nt-field">
            <h2>{words.text("account.texts-title")}</h2>
            {shown.map((text) => (
              <LegalText key={text.id} text={text} level={3} />
            ))}
            <div className="nt-check">
              <input
                ref={textsField}
                id={`${id}-texts`}
                type="checkbox"
                checked={accepted}
                aria-invalid={textsError !== undefined}
                aria-describedby={described(textsError !== undefined && `${id}-texts-error`)}
                onChange={(event) => setAcceptedFor(event.target.checked ? versions : undefined)}
              />
              <label htmlFor={`${id}-texts`}>{words.text("account.texts")}</label>
            </div>
            {textsError === undefined ? null : (
              <p id={`${id}-texts-error`} className="nt-error">
                {textsError}
              </p>
            )}
          </div>
        )}
        <button type="submit" disabled={pending || texts.status !== "done"}>
          {words.text("account.create")}
        </button>
        {/* api has texts in force that the screen did not get to show: said all the same. */}
        {shown.length === 0 && textsError !== undefined ? (
          <p role="alert" className="nt-error">
            {textsError}
          </p>
        ) : null}
        <FormFailure failure={failure} />
      </form>
    </Screen>
  );
}

/** The owner's own profile as a learner: a pseudonym and the country, of the category `adult`. */
export function OwnerProfileScreen({
  onCreate,
}: {
  readonly onCreate: (
    pseudonym: string,
    country: string,
  ) => Promise<"done" | "country-not-accepted" | Failure>;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const pseudonymField = useRef<HTMLInputElement>(null);
  const countryField = useRef<HTMLSelectElement>(null);
  const countries = useMemo(() => countryNames(language), [language]);
  const [pseudonym, setPseudonym] = useState("");
  const [country, setCountry] = useState("");
  const [pseudonymError, setPseudonymError] = useState(false);
  const [countryError, setCountryError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = pseudonymOf(pseudonym);
    const noCountry = country === "" ? words.text("profile.country-choose") : undefined;
    setPseudonymError(name === undefined);
    setCountryError(noCountry);
    setFailure(undefined);
    if (name === undefined) return pseudonymField.current?.focus();
    if (noCountry !== undefined) return countryField.current?.focus();
    setPending(true);
    const result = await onCreate(name, country);
    setPending(false);
    if (result === "country-not-accepted") {
      setCountryError(words.text("profile.country-not-accepted"));
      countryField.current?.focus();
    } else if (result !== "done") {
      setFailure(result);
    }
  }

  return (
    <Screen title={words.text("profile.title")}>
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
            aria-describedby={described(
              `${id}-pseudonym-hint`,
              pseudonymError && `${id}-pseudonym-error`,
            )}
            onChange={(event) => setPseudonym(event.target.value)}
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
        <div className="nt-field">
          <label htmlFor={`${id}-country`}>{words.text("profile.country")}</label>
          <select
            ref={countryField}
            id={`${id}-country`}
            value={country}
            aria-invalid={countryError !== undefined}
            aria-describedby={described(countryError !== undefined && `${id}-country-error`)}
            onChange={(event) => setCountry(event.target.value)}
          >
            <option value="">{words.text("profile.country-choose")}</option>
            {countries.map(({ code, name }) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {countryError === undefined ? null : (
            <p id={`${id}-country-error`} className="nt-error">
              {countryError}
            </p>
          )}
        </div>
        <button type="submit" disabled={pending}>
          {words.text("profile.create")}
        </button>
        <FormFailure failure={failure} />
      </form>
    </Screen>
  );
}

/** What the browser said of keeping the site's data. */
type Kept = "granted" | "refused";

/** Asks the browser to keep the site's data: no browser that cannot is asked. */
async function persist(): Promise<Kept> {
  return (await siteStorage.persist()) ? "granted" : "refused";
}

/**
 * The choice of the learner: the owner's profile with no PIN while the account has no child
 * (section 3.6), and on the first sign-in the line that learners' work is kept here (section 3.2);
 * below, the way into the section for adults and the sign-out.
 */
export function ChooseScreen({
  profiles,
  first,
  onChoose,
  onSignOut,
}: {
  readonly profiles: readonly Profile[];
  readonly first: boolean;
  readonly onChoose: (profile: Profile) => void;
  readonly onSignOut: () => void;
}) {
  const { words } = useLanguage();
  const [kept, setKept] = useState<Kept | undefined>(undefined);
  return (
    <Screen title={words.text("choose.title")}>
      <ul className="nt-buttons">
        {profiles.map((profile) => (
          <li key={profile.profileId}>
            <button type="button" onClick={() => onChoose(profile)}>
              {profile.pseudonym}
            </button>
          </li>
        ))}
      </ul>
      {first ? (
        <section>
          <p>{words.text("persist.line")}</p>
          {kept === undefined ? (
            <button
              type="button"
              className="nt-secondary"
              onClick={() => void persist().then(setKept)}
            >
              {words.text("persist.ask")}
            </button>
          ) : null}
          <p role="status">{kept === undefined ? null : words.text(`persist.${kept}`)}</p>
        </section>
      ) : null}
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={() => navigate(ADULTS)}>
          {words.text("adults.title")}
        </button>
        <button type="button" className="nt-secondary" onClick={onSignOut}>
          {words.text("signout.button")}
        </button>
      </div>
    </Screen>
  );
}

/** Before the sign-out: what it takes from this device (section 3.2), and a way back. */
export function SignOutScreen({
  device,
  profiles,
  onConfirm,
  onCancel,
}: {
  readonly device: Device;
  readonly profiles: readonly Profile[];
  readonly onConfirm: () => Promise<"erased" | "left" | "failed">;
  readonly onCancel: () => void;
}) {
  const { words } = useLanguage();
  const [work, setWork] = useState<Unfinished[] | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    void unfinishedWork(device, profiles)
      .catch((): Unfinished[] => [])
      .then((found) => {
        if (current) setWork(found);
      });
    return () => {
      current = false;
    };
  }, [device, profiles]);
  return (
    <Screen title={words.text("signout.title")}>
      <p>{words.text("signout.erases")}</p>
      {work === undefined ? null : work.length === 0 ? (
        <p>{words.text("signout.nothing")}</p>
      ) : (
        <ul>
          {work.map(({ profileId, pseudonym, count }) => (
            <li key={profileId}>{words.text("signout.unfinished", { pseudonym, count })}</li>
          ))}
        </ul>
      )}
      <div className="nt-buttons">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            setFailed(false);
            void onConfirm().then((done) => {
              if (done !== "failed") return;
              setPending(false);
              setFailed(true);
            });
          }}
        >
          {words.text("signout.confirm")}
        </button>
        <button type="button" className="nt-secondary" onClick={onCancel}>
          {words.text("common.cancel")}
        </button>
      </div>
      {failed ? (
        <p role="alert" className="nt-error">
          {words.text("signout.failed")}
        </p>
      ) : null}
    </Screen>
  );
}
