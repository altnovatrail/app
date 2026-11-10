// The start of the app (R09 in docs/decisions.md; section 3.7 of docs/architecture.md): in a frame
// of another page, a static screen, no request and no storage; otherwise /deployment.json first,
// before any other request, then the start of the storage on the device (R16; section 3.2), and the
// app only once both are done. A failed preload after a rollout, or a database a newer build has
// opened, offers a reload over whatever is shown; storage erased or unreadable while app is open
// is a screen of its own. Below it the app has the client of api for the file's api (R18): an
// account that is gone it signs out of and erases, on no access it erases what is left of the
// account before, and when api no longer has a method it offers the reload. The sign-in service is
// made only once the storage's start has compared its project with the registry's, and never while
// another tab holds the previous project's session (R19; section 3.7); its window is in the language
// of the screens. The language of the
// screens is the device's: the choice kept in the device's settings, which are no part of the account's storage and are read beside the request
// for the file, before the first screen and for a second at most, else navigator.languages (R10,
// R17; section 3.8); a choice made in another tab comes by BroadcastChannel. In a frame,
// navigator.languages alone.
import "../theme/theme.css";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { Tokens } from "../api/tokens.ts";
import type { Deployment } from "../config/deployment.ts";
import { type Loaded, loadDeployment } from "../config/load.ts";
import { LanguageProvider, type LanguageState } from "../i18n/LanguageContext.tsx";
import { deviceLanguage, type Language, lookup } from "../i18n/language.ts";
import { WORDS } from "../i18n/words.ts";
import { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { type Packages, PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import { firebaseSignIn } from "../signin/firebase.ts";
import { SignInProvider } from "../signin/SignInContext.tsx";
import type { SignInService } from "../signin/service.ts";
import type { Device } from "../storage/device.ts";
import { eraseAccount, noAccess, type SignInCheck } from "../storage/erase.ts";
import { readLanguage, writeLanguage } from "../storage/settings.ts";
import { startStorage } from "../storage/start.ts";
import { Framed, Offline, OtherTab, ReloadOffer, StorageGone, Unconfigured } from "./Screens.tsx";
import { type Trouble, troubleOf } from "./storage.ts";

const DeploymentContext = createContext<Deployment | undefined>(undefined);

/** The channel the tabs of app tell each other of the device's language on. */
export const SETTINGS_CHANNEL = "novatrail-settings";

/** The language a tag names, if the build has it: a newer build may have written another. */
function known(tag: unknown): Language | undefined {
  return typeof tag === "string" ? lookup(tag) : undefined;
}

/** The storage on the device, started, and what came of its sign-in project against the registry. */
export interface DeviceStorage {
  readonly device: Device;
  readonly signIn: SignInCheck;
}

const StorageContext = createContext<DeviceStorage | undefined>(undefined);

/** One start of the storage per device, however often React runs the effect (StrictMode). */
const starts = new WeakMap<Device, Promise<SignInCheck>>();

function start(device: Device, signIn: Deployment["signIn"]): Promise<SignInCheck> {
  let started = starts.get(device);
  if (started === undefined) {
    // A start that failed outright holds the app up no more than one whose steps failed.
    started = startStorage(device, signIn).catch((): SignInCheck => "failed");
    starts.set(device, started);
  }
  return started;
}

/** The sign-in service of a device's page: one, however often React runs the effect. */
const services = new WeakMap<Device, SignInService>();

/** Makes the sign-in service of a deployment: Firebase Auth in the browser. */
export type SignInFactory = (signIn: Deployment["signIn"]) => SignInService;

/** The storage the start started; only the app below Boot has it. */
export function useStorage(): DeviceStorage {
  const storage = useContext(StorageContext);
  if (storage === undefined) throw new Error("useStorage outside Boot");
  return storage;
}

/** The deployment configuration the start read; only the app below Boot has it. */
export function useDeployment(): Deployment {
  const deployment = useContext(DeploymentContext);
  if (deployment === undefined) throw new Error("useDeployment outside Boot");
  return deployment;
}

export interface BootProps {
  /** Whether app is open in a frame: `window.top !== window.self`. */
  readonly framed: boolean;
  /** The origin app is open at. */
  readonly origin: string;
  /** The languages of the device: navigator.languages. */
  readonly languages: readonly string[];
  /** The storage on the device; nothing of it opens in a frame. */
  readonly device: Device;
  readonly fetcher?: typeof fetch;
  /** Makes the sign-in service once the storage has started: Firebase Auth when left out. */
  readonly signIn?: SignInFactory;
  /** fetch for the calls of api; the browser's when left out. */
  readonly apiFetch?: typeof fetch;
  /** How long the first screen waits for the device's settings, ms: an open that hangs gets no more. */
  readonly settingsWait?: number;
  readonly children: ReactNode;
}

/** A second: the settings are one small record, and a screen must come even if IndexedDB hangs. */
export const SETTINGS_WAIT_MS = 1000;

export function Boot({
  framed,
  origin,
  languages,
  device,
  fetcher,
  settingsWait = SETTINGS_WAIT_MS,
  signIn: makeSignIn = firebaseSignIn,
  apiFetch,
  children,
}: BootProps) {
  const [chosen, setChosen] = useState<Language | undefined>(undefined);
  // In a frame no storage opens: the device's languages are all there is.
  const [settingsRead, setSettingsRead] = useState(framed);
  const language = chosen ?? deviceLanguage(languages);
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [stale, setStale] = useState(false);
  const [storage, setStorage] = useState<DeviceStorage | undefined>(undefined);
  const [trouble, setTrouble] = useState<Exclude<Trouble, "newer"> | undefined>(undefined);
  const [service, setService] = useState<SignInService | undefined>(undefined);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (framed) return;
    let current = true;
    const waited = setTimeout(() => {
      if (current) setSettingsRead(true);
    }, settingsWait);
    void readLanguage(device).then((tag) => {
      if (!current) return;
      clearTimeout(waited);
      setChosen((held) => held ?? known(tag));
      setSettingsRead(true);
    });
    return () => {
      current = false;
      clearTimeout(waited);
    };
  }, [framed, device, settingsWait]);

  // One channel for the tab, which tells the others and hears them: a channel never hears itself.
  const channel = useRef<BroadcastChannel | undefined>(undefined);
  useEffect(() => {
    if (framed || typeof BroadcastChannel === "undefined") return;
    const opened = new BroadcastChannel(SETTINGS_CHANNEL);
    opened.onmessage = (event: MessageEvent) => {
      const found = known(event.data);
      if (found !== undefined) setChosen(found);
    };
    channel.current = opened;
    return () => {
      channel.current = undefined;
      opened.close();
    };
  }, [framed]);

  const choose = useCallback(
    (next: Language) => {
      setChosen(next);
      // The other tabs hear of a choice that was kept, not of one the next start would not find.
      void writeLanguage(device, next).then((kept) => {
        if (kept) channel.current?.postMessage(next);
      });
    },
    [device],
  );

  // The client of api, once the file names it (R18): its refusals reach the device here.
  // The checks of packages, which the client's refusals reach before the packages are made.
  const checking = useRef<PackageChecks | undefined>(undefined);
  // The client is made once for the file's api: the sign-in service and fetch are read at each call,
  // so that a parent that gives a new fetch makes no new client and asks nothing again, and a client
  // made before the sign-in service has no token until there is one.
  const given = useRef({ service, apiFetch });
  given.current = { service, apiFetch };
  const apiOrigin = loaded?.kind === "ready" ? loaded.deployment.api : undefined;
  const api = useMemo(() => {
    if (apiOrigin === undefined) return undefined;
    const current: Tokens = {
      token: async (refresh) => given.current.service?.token(refresh),
      signOut: async () => given.current.service?.signOut(),
    };
    // Two requests that meet the account gone at once erase it once; an account gone later, after
    // another sign-in on the same page, is erased again.
    let leaving: Promise<void> | undefined;
    return createApi({
      baseUrl: apiOrigin,
      tokens: current,
      fetch: (input, init) => (given.current.apiFetch ?? globalThis.fetch)(input, init),
      on: {
        stale: () => setStale(true),
        accountGone: () => {
          // Signed out first, as erase.ts has it; what is not erased, the next start erases.
          leaving ??= current
            .signOut()
            .catch(() => {})
            .then(() => eraseAccount(device))
            .then(() => {})
            .finally(() => {
              leaving = undefined;
            });
          return leaving;
        },
        noAccess: async () => {
          await noAccess(device);
        },
        // CAUSE_VERSION_NOT_GIVEN from any service asks CheckPackages (T21).
        withdrawn: () => void checking.current?.check(),
      },
    });
  }, [apiOrigin, device]);

  // The packages, once the client is there: their open views, the files of their device parts and
  // the check of what api no longer gives (T21).
  const packages = useMemo<Packages | undefined>(() => {
    if (api === undefined || apiOrigin === undefined) return undefined;
    const checks = new PackageChecks(api, device);
    checking.current = checks;
    const withdrawn = () => void checks.check();
    return {
      checks,
      views: new OpenViews({
        api,
        device,
        stale: () => setStale(true),
        withdrawn: (digest) => checks.withdrawn.has(digest),
      }),
      files: new DeviceFiles({
        api: apiOrigin,
        withdrawn,
        fetch: (input, init) => (given.current.apiFetch ?? globalThis.fetch)(input, init),
      }),
    };
  }, [api, apiOrigin, device]);

  const state = useMemo<LanguageState>(
    () => ({ language, words: WORDS[language], choose }),
    [language, choose],
  );

  useEffect(() => {
    // Vite tells of a module of the build that is not on the hosting any more (section 3.7).
    const onPreloadError = (event: Event) => {
      event.preventDefault();
      setStale(true);
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  useEffect(() => {
    if (framed) return;
    let gone = false;
    const stop = device.listen((event) => {
      // Once a screen says the storage is gone, nothing more is asked of it.
      if (gone) return;
      void troubleOf(device, event).then((found) => {
        if (found === "newer") setStale(true);
        else if (found !== undefined && !gone) {
          gone = true;
          stop();
          setTrouble(found);
        }
      });
    });
    return stop;
  }, [framed, device]);

  const signIn = loaded?.kind === "ready" ? loaded.deployment.signIn : undefined;
  // The factory as first given: the service of a page is made once.
  const factory = useRef(makeSignIn);
  useEffect(() => {
    if (signIn === undefined) return;
    let current = true;
    void start(device, signIn).then((check) => {
      if (!current) return;
      setStorage({ device, signIn: check });
      // Only once the project is compared, and never over another tab's session of the previous
      // one: initializeAuth would read it as this project's (section 3.7).
      if (check !== "same" && check !== "erased") return;
      let made = services.get(device);
      if (made === undefined) {
        made = factory.current(signIn);
        services.set(device, made);
      }
      setService(made);
    });
    return () => {
      current = false;
    };
  }, [device, signIn]);

  // Google's window in the language of the screens.
  useEffect(() => {
    service?.setLanguage(language);
  }, [service, language]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt asks for the file again.
  useEffect(() => {
    if (framed) return;
    let current = true;
    // A screen already shown stays while the file is asked for again, its button keeping focus.
    // A failure reading cannot name is one more try away, as a network that did not answer.
    void loadDeployment(origin, fetcher)
      .catch((): Loaded => ({ kind: "offline" }))
      .then((result) => {
        if (current) setLoaded(result);
      });
    return () => {
      current = false;
    };
  }, [framed, origin, fetcher, attempt]);

  return <LanguageProvider value={state}>{screen()}</LanguageProvider>;

  /** The app, once the storage has started and the sign-in service is there. */
  function app(): ReactNode {
    if (storage === undefined || api === undefined || packages === undefined) return null;
    if (storage.signIn === "blocked") return <OtherTab />;
    if (storage.signIn === "failed") return <StorageGone trouble="unreadable" />;
    if (service === undefined) return null;
    return (
      <StorageContext.Provider value={storage}>
        <ApiProvider value={api}>
          <PackagesProvider value={packages}>
            <SignInProvider value={service}>{children}</SignInProvider>
          </PackagesProvider>
        </ApiProvider>
      </StorageContext.Provider>
    );
  }

  function screen(): ReactNode {
    const offer = stale ? <ReloadOffer /> : null;
    if (framed) return <Framed />;
    if (trouble !== undefined) return <StorageGone trouble={trouble} />;
    // The first screen waits for the device's settings: its language does not change under a finger.
    if (loaded === undefined || !settingsRead) return offer;
    switch (loaded.kind) {
      case "offline":
        return (
          <>
            {offer}
            <Offline onRetry={() => setAttempt((n) => n + 1)} />
          </>
        );
      case "unconfigured":
        return (
          <>
            {offer}
            <Unconfigured detail={loaded.detail} />
          </>
        );
      case "ready":
        return (
          <DeploymentContext.Provider value={loaded.deployment}>
            {offer}
            {app()}
          </DeploymentContext.Provider>
        );
    }
  }
}
