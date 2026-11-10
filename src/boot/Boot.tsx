// The start of the app (R09 in docs/decisions.md; section 3.7 of docs/architecture.md): in a frame
// of another page, a static screen and no request; otherwise /deployment.json first, before any
// other request, and the app only once it is read. A failed preload after a rollout offers a
// reload over whatever is shown.
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { Deployment } from "../config/deployment.ts";
import { type Loaded, loadDeployment } from "../config/load.ts";
import { deviceLanguage } from "./language.ts";
import { Framed, Offline, ReloadOffer, Unconfigured } from "./Screens.tsx";

const DeploymentContext = createContext<Deployment | undefined>(undefined);

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
  readonly fetcher?: typeof fetch;
  readonly children: ReactNode;
}

export function Boot({ framed, origin, languages, fetcher, children }: BootProps) {
  const language = deviceLanguage(languages);
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [stale, setStale] = useState(false);

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
          {children}
        </DeploymentContext.Provider>
      );
  }
}
