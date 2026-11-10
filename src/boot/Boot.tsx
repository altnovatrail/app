// The start of the app (R09 in docs/decisions.md; section 3.7 of docs/architecture.md): in a frame
// of another page, a static screen, no request and no storage; otherwise /deployment.json first,
// before any other request, then the start of the storage on the device (R16; section 3.2), and the
// app only once both are done. A failed preload after a rollout, or a database a newer build has
// opened, offers a reload over whatever is shown; storage erased or unreadable while app is open
// is a screen of its own.
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { Deployment } from "../config/deployment.ts";
import { type Loaded, loadDeployment } from "../config/load.ts";
import type { Device } from "../storage/device.ts";
import type { SignInCheck } from "../storage/erase.ts";
import { startStorage } from "../storage/start.ts";
import { deviceLanguage } from "./language.ts";
import { Framed, Offline, ReloadOffer, StorageGone, Unconfigured } from "./Screens.tsx";
import { type Trouble, troubleOf } from "./storage.ts";

const DeploymentContext = createContext<Deployment | undefined>(undefined);

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
  readonly children: ReactNode;
}

export function Boot({ framed, origin, languages, device, fetcher, children }: BootProps) {
  const language = deviceLanguage(languages);
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [stale, setStale] = useState(false);
  const [storage, setStorage] = useState<DeviceStorage | undefined>(undefined);
  const [trouble, setTrouble] = useState<Exclude<Trouble, "newer"> | undefined>(undefined);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

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
  useEffect(() => {
    if (signIn === undefined) return;
    let current = true;
    void start(device, signIn).then((check) => {
      if (current) setStorage({ device, signIn: check });
    });
    return () => {
      current = false;
    };
  }, [device, signIn]);

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

  const offer = stale ? <ReloadOffer language={language} /> : null;
  if (framed) return <Framed language={language} />;
  if (trouble !== undefined) return <StorageGone language={language} trouble={trouble} />;
  if (loaded === undefined) return offer;
  switch (loaded.kind) {
    case "offline":
      return (
        <>
          {offer}
          <Offline language={language} onRetry={() => setAttempt((n) => n + 1)} />
        </>
      );
    case "unconfigured":
      return (
        <>
          {offer}
          <Unconfigured language={language} detail={loaded.detail} />
        </>
      );
    case "ready":
      return (
        <DeploymentContext.Provider value={loaded.deployment}>
          {offer}
          {storage === undefined ? null : (
            <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>
          )}
        </DeploymentContext.Provider>
      );
  }
}
