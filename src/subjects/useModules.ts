// The modules of a profile as Home and Subjects show them: the ones connected, each a
// card — on Home with the states of its skills —, and — on Subjects — the catalog of the server, read together
// and each module's manifest once. Connecting and disconnecting are a press away; api's answer is
// the list of connected modules, the catalog stays, and the focus goes with the card to its new
// place, its button found by `data-module` and `data-action`, or the button in what they mark.
import type { ConnectedModule } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import { cardsOf, type ModuleCard, type ModuleRef } from "./modules.ts";
import { useSequential } from "./useSequential.ts";
import { useSkillCounts } from "./useSkillCounts.ts";

/** What a card's button does to its module. */
export type CardAction = "connect" | "disconnect";

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "done"; readonly connected: ModuleCard[]; readonly catalog: ModuleCard[] };

/** The key of a module at a version: a module in both lists is one card. */
const keyOf = (module: ModuleRef) => `${module.moduleId} ${module.packageDigest}`;

/** The modules of the profile; the catalog read too where `withCatalog` says so. */
export function useModules(profileId: string, withCatalog: boolean) {
  const api = useApi();
  const { views } = usePackages();
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  // The button the focus goes to once a card has moved: its own, in its new list.
  const focus = useRef<{ moduleId: string; action: CardAction } | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the lists again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    void Promise.all([
      api.module.listConnectedModules({ profileId }),
      withCatalog ? api.module.listCatalog({ profileId }) : { modules: [] },
    ])
      .then(async ([own, catalog]) => {
        // One card for a module in both lists: its manifest is read once.
        const all = new Map<string, ModuleRef>();
        // The connected list's own, which says whether the module is solved on the sheet.
        for (const module of [...own.modules, ...catalog.modules]) {
          if (!all.has(keyOf(module))) all.set(keyOf(module), module);
        }
        const cards = await cardsOf(views, [...all.values()]);
        const byKey = new Map([...all.keys()].map((key, i) => [key, cards[i] as ModuleCard]));
        const pick = (modules: readonly ModuleRef[]) =>
          modules.map((module) => byKey.get(keyOf(module)) as ModuleCard);
        return { connected: pick(own.modules), catalog: pick(catalog.modules) };
      })
      .then(
        ({ connected, catalog }) => {
          if (current) setRead({ status: "done", connected, catalog });
        },
        (reason: unknown) => {
          if (current) setRead({ status: "failed", failure: parseFailure(reason) });
        },
      );
    return () => {
      current = false;
    };
  }, [api, views, profileId, withCatalog, attempt]);

  // Once a card has moved, its button in the new list takes the focus the old one had.
  useEffect(() => {
    const target = focus.current;
    if (target === undefined || read.status !== "done") return;
    focus.current = undefined;
    // The button itself, or what holds it: a connected card's ⋯, which its pop-over's Disconnect left.
    const at = document.querySelector<HTMLElement>(
      `[data-module="${CSS.escape(target.moduleId)}"][data-action="${target.action}"]`,
    );
    (at instanceof HTMLButtonElement ? at : at?.querySelector("button"))?.focus();
  });

  const change = useCallback(
    async (
      moduleId: string,
      then: CardAction,
      call: () => Promise<{ modules: ConnectedModule[] }>,
    ) => {
      setPending(true);
      setFailure(undefined);
      try {
        const connected = await cardsOf(views, (await call()).modules);
        focus.current = { moduleId, action: then };
        setRead((held) => (held.status === "done" ? { ...held, connected } : held));
      } catch (reason) {
        setFailure(parseFailure(reason));
      } finally {
        setPending(false);
      }
    },
    [views],
  );
  const connect = useCallback(
    (moduleId: string) =>
      void change(moduleId, "disconnect", () => api.module.connectModule({ profileId, moduleId })),
    [api, profileId, change],
  );
  const disconnect = useCallback(
    (moduleId: string) =>
      void change(moduleId, "connect", () => api.module.disconnectModule({ profileId, moduleId })),
    [api, profileId, change],
  );
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const done = read.status === "done";
  const own = useSequential(views, done ? read.connected : undefined);
  // The states of the skills, on Home's cards and on the connected cards of Subjects.
  const connected = useSkillCounts(api, views, profileId, own);
  const catalog = useSequential(views, done ? read.catalog : undefined);
  return {
    failed: read.status === "failed" ? read.failure : undefined,
    connected,
    catalog,
    failure,
    pending,
    connect,
    disconnect,
    retry,
  };
}
