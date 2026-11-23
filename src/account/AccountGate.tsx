// The way into the app: the sign-in, the invite code of a user with no account with
// the legal texts it accepts, the owner's own profile and the choice of the learner, each a
// screen of its own in the language of the device; the sign-out asks nothing and erases nothing.
// The app below it opens only once a learner is chosen, so that nothing of it opens before
// the device has erased what an account other than the one api names left there. The section for
// adults opens from the choice of the learner and from the bar above the learner's screens, in
// place of either, while the account is open; a profile it changes, the other tabs hear of by
// BroadcastChannel, and a change they tell of comes here. The legal pages show at any step, before
// signing in too, from the sign-in screen and from the section's first page, and their bar goes
// back to where they were opened from; the section's first page tells of a text's next version
// and opens its page. So does the license of a module's version,
// opened from a module's card on Home, in the language of the learner's screens while a learner is
// chosen, and closed home; and so does the page on the AI tutor, opened from Home too,
// which opens the page of who runs this copy, whose bar comes back to it.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AdultSection } from "../adults/AdultSection.tsx";
import { useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import {
  ADULTS,
  HOME,
  LEGAL,
  MODULE_LICENSE,
  navigate,
  type Route,
  TUTOR,
  useRoute,
} from "../app/router.ts";
import { Waiting } from "../app/Waiting.tsx";
import { useDeployment, useStorage } from "../boot/Boot.tsx";
import { Held, Offline, ReadFailed, StorageGone } from "../boot/Screens.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LearnerLanguage } from "../i18n/LearnerLanguage.tsx";
import { LegalPages, legalPage, OPERATOR } from "../legal/LegalPages.tsx";
import { accountTexts, type Legal, readLegal } from "../legal/texts.ts";
import { KeyHolderProvider, keyed, useTabHolder } from "../ownkey/OwnKeyContext.tsx";
import { LicensePages } from "../packages/LicensePage.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { useSignIn } from "../signin/SignInContext.tsx";
import { SignInScreen } from "../signin/SignInScreen.tsx";
import { TutorPages } from "../tutor/TutorPage.tsx";
import { ChooseScreen } from "./ChooseScreen.tsx";
import { type InviteDraft, InviteScreen } from "./InviteScreen.tsx";
import { OwnerProfileScreen } from "./OwnerProfileScreen.tsx";
import { Session } from "./session.ts";
import { PROFILES_CHANNEL, profileMessage, profileOf } from "./settings.ts";

/** The learner chosen, and what the bar above the learner's screens does. */
export interface Learner {
  readonly learner: Profile;
  readonly switchLearner: () => void;
  readonly signOut: () => void;
  /** Opens a legal page, whose bar goes back home: the adult's Help leads to three. */
  readonly openLegal: (page: Route) => void;
  /** api changed the profile on a learner's screen — its voicing: the session takes it. */
  readonly onSaved: (profile: Profile) => void;
  /** A request of a learner's screen about the profile did not go through. */
  readonly onFailed: (failure: Failure) => void;
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
  // The own key is in memory while the owner profile of the category adult is the learner chosen,
  // and leaves it with that profile: "Switch learner", the sign-out, another account.
  const holder = useTabHolder(device);
  const owner = state.step === "learning" && keyed(state.learner) ? state.learner.profileId : "";
  // Only whether the holder is open for the owner profile: a refusal noted renders nothing here.
  const opened = useSyncExternalStore(holder.subscribe, () => {
    const held = holder.snapshot();
    return held.status === "open" && held.profileId === owner;
  });
  useEffect(() => {
    if (owner === "") holder.close();
    else void holder.open(owner);
  }, [holder, owner]);
  const [left, setLeft] = useState(false);
  const { language } = useLanguage();
  const route = useRoute();
  // Where the legal pages' close goes back to: home, unless the section opened them. Memory alone,
  // as the profile the section chose: after a reload, home.
  const [legalBack, setLegalBack] = useState<Route>(HOME);
  // What the owner typed and ticked on the invite code's screen, kept while the legal pages stand in
  // its place, and dropped once the step is over: the account made, or signed out.
  const inviteDraft = useRef<InviteDraft | undefined>(undefined);
  useEffect(() => {
    if (state.step !== "invite") inviteDraft.current = undefined;
  }, [state.step]);
  const openLegal = useCallback((back: Route, page: Route = LEGAL) => {
    setLegalBack(back);
    navigate(page);
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
  // A profile api changed — in the section or on a learner's screen —: the session's, and the other
  // tabs'.
  const onSaved = useCallback(
    (changed: Profile) => {
      session.profileChanged(changed);
      channel.current?.postMessage(profileMessage(changed));
    },
    [session],
  );
  const onFailed = useCallback((failure: Failure) => session.profileFailed(failure), [session]);
  // The screen they close to is Home while a learner is chosen, in their language.
  if (route.screen === MODULE_LICENSE.screen || route.screen === TUTOR.screen) {
    const pages =
      route.screen === TUTOR.screen ? (
        <TutorPages route={route} onOperator={() => openLegal(TUTOR, legalPage(OPERATOR))} />
      ) : (
        <LicensePages route={route} />
      );
    if (state.step !== "learning") return pages;
    return <LearnerLanguage field={state.learner.interfaceLanguage}>{pages}</LearnerLanguage>;
  }
  // Back to the section only while its account is open: once it has gone, home. The page on the AI
  // tutor shows at any step, and so is gone back to at any step.
  if (route.screen === LEGAL.screen) {
    const back = open || legalBack.screen === TUTOR.screen ? legalBack : HOME;
    return <LegalPages route={route} back={back} />;
  }
  if (open && route.screen === ADULTS.screen) {
    return (
      <KeyHolderProvider holder={holder}>
        <AdultSection
          route={route}
          device={device}
          profiles={state.account.profiles}
          onSaved={onSaved}
          onFailed={onFailed}
          // The own key is the owner profile's: the page opens it, with no PIN while the account
          // has no child.
          {...(state.step === "choose" ? { onOpenOwner: () => session.choose() } : {})}
          onEraseAll={async () => {
            const done = await session.eraseEverything();
            if (done === "failed") return "failed";
            // The sign-in comes next, and after it home, not the page of a device erased.
            setLeft(done === "left");
            navigate(HOME);
            return done;
          }}
          onLegal={(page) => openLegal(ADULTS, page)}
        />
      </KeyHolderProvider>
    );
  }
  switch (state.step) {
    case "starting":
    case "loading":
      // What comes next is the way in or "Who is learning?": the sky, never a white page.
      return <Waiting ground="sky" />;
    case "signed-out":
      return (
        <SignInScreen
          onSignIn={async () => {
            setLeft(false);
            return session.signIn();
          }}
          {...(state.result === undefined ? {} : { result: state.result })}
          left={left}
          onLegal={(page) => openLegal(HOME, page)}
        />
      );
    case "offline":
      return <Offline onRetry={() => void session.load()} />;
    case "unreadable":
      return <StorageGone trouble="unreadable" />;
    case "held":
      return <Held onRetry={() => void session.load()} />;
    case "failed":
      return <ReadFailed failure={state.failure} onRetry={() => void session.load()} />;
    case "invite":
      return (
        <InviteStep
          session={session}
          draft={inviteDraft}
          onLegal={(page) => openLegal(HOME, page)}
        />
      );
    case "owner-profile":
      return (
        <OwnerProfileScreen
          onCreate={(pseudonym, country, avatar) =>
            session.createOwnerProfile(pseudonym, country, language, avatar)
          }
        />
      );
    case "choose":
      return (
        <ChooseScreen
          profiles={[state.owner]}
          first={state.first}
          onChoose={() => session.choose()}
          onSignOut={() => void session.signOut()}
        />
      );
    case "learning":
      // The learner's screens open once the key the owner profile keeps here is in memory: their
      // first request already names its provider.
      if (owner !== "" && !opened) return <Waiting ground="page" />;
      return (
        <KeyHolderProvider holder={holder}>
          <LearnerProvider
            value={{
              learner: state.learner,
              switchLearner: () => session.switchLearner(),
              signOut: () => void session.signOut(),
              openLegal: (page) => openLegal(HOME, page),
              onSaved,
              onFailed,
            }}
          >
            {children}
          </LearnerProvider>
        </KeyHolderProvider>
      );
  }
}

/**
 * The legal texts of the account, read in the language of the screen — the current versions and
 * the next ones —, and the screen with them.
 */
function InviteStep({
  session,
  draft,
  onLegal,
}: {
  readonly session: Session;
  readonly draft: RefObject<InviteDraft | undefined>;
  readonly onLegal: (page: Route) => void;
}) {
  const { language } = useLanguage();
  const read = useCallback(
    async (api: Api): Promise<Legal> => {
      const { texts, next } = await readLegal(api, language);
      return { texts: accountTexts(texts), next: accountTexts(next) };
    },
    [language],
  );
  const texts = useRequest(read);
  return (
    <InviteScreen
      texts={texts}
      draft={draft}
      onCreate={(code, accepted) => session.createAccount(code, accepted)}
      onLegal={onLegal}
      onSignOut={() => void session.signOut()}
    />
  );
}
