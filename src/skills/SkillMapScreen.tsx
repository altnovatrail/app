// The skill map, the learner's second way in beside My subjects (product 4 in spec; R34 in
// docs/decisions.md; section 3.10 of docs/architecture.md), in the language of the learner's
// screens. `#/skill-map` lists the modules connected, each a card as My subjects names it with the
// way to its map; `#/skill-map/<module>` is the map of a module's current version, the learner's
// view of skill-map's element, by `GetSkillMap` and the open views of its graph and manifest.
// Practise on the map asks `ChooseNext` with the skill chosen, and goes to what the engine gives;
// the skill holds while the learner works, until they ask for something else — `ChooseNext`
// without a skill, "What's next" in My subjects (R107 in spec). Choosing closes the attempt open
// outside a lesson for good: while one is open, a question says so first. Beside an anchor skill
// whose holding is unknown, the modules of the catalog that teach it are offered with Connect,
// `ConnectModule`, above the map, as the element shows no `teaching_modules` (Д211 in the table 4
// of spec's RUN.md); once one is connected, the map's state is read again in place.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure } from "../api/failure.ts";
import { outcomeOf } from "../api/outcome.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { failureText, outcomeText } from "../api/words.ts";
import { HOME, navigate, type Route, redirect, SKILL_MAP } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { givenOf } from "../next/choice.ts";
import { useEngine } from "../next/useEngine.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import { CardHeading } from "../subjects/CardHeading.tsx";
import { ModuleCardItem, ModuleCardList, useConnectedCards } from "../subjects/ModuleCards.tsx";
import { cardsOf } from "../subjects/modules.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { type ModuleMap, offeredModules, readModuleMap } from "./map.ts";
import { MapHeading, ModuleSkillMap, mapTitle } from "./SkillMap.tsx";

/** The map of a module, by its ID. */
export function moduleMapRoute(moduleId: string): Route {
  return { screen: SKILL_MAP.screen, parts: [moduleId] };
}

/** The ways out of a screen of the map: to the list of maps from a module's, and home. */
function Ways({ all }: { readonly all: boolean }) {
  const { words } = useLanguage();
  return (
    <div className="nt-buttons">
      {all ? (
        <button type="button" className="nt-secondary" onClick={() => navigate(SKILL_MAP)}>
          {words.text("skillmap.all")}
        </button>
      ) : null}
      <button type="button" className="nt-secondary" onClick={() => navigate(HOME)}>
        {words.text("task.home")}
      </button>
    </div>
  );
}

/** `#/skill-map`: the modules connected, each with the way to its map. */
function MapList({ profileId }: { readonly profileId: string }) {
  const { words } = useLanguage();
  const cards = useConnectedCards(profileId);
  let shown = null;
  if (cards.status === "failed") {
    shown = <ReadFailure failure={cards.failure} onRetry={cards.retry} />;
  } else if (cards.status === "done") {
    shown =
      cards.value.length === 0 ? (
        <p>{words.text("subjects.none")}</p>
      ) : (
        <ModuleCardList
          cards={cards.value}
          onRetry={cards.retry}
          render={(card) => (
            <ModuleCardItem
              key={card.moduleId}
              card={card}
              {...(card.digest === undefined
                ? {}
                : {
                    action: {
                      text: words.text("skillmap.open"),
                      onPress: () => navigate(moduleMapRoute(card.moduleId)),
                    },
                  })}
            />
          )}
        />
      );
  }
  return (
    <Screen title={words.text("skillmap.title")}>
      <Ways all={false} />
      {shown}
    </Screen>
  );
}

/**
 * The modules offered beside the anchor skills whose holding is unknown, named by the manifests of
 * their current versions, which the catalog gives; one the catalog no longer gives is shown
 * unavailable, with no button. A module connected says so in place of its button.
 */
function Offered({
  profileId,
  moduleIds,
  onConnected,
}: {
  readonly profileId: string;
  readonly moduleIds: readonly string[];
  readonly onConnected: () => void;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const { views } = usePackages();
  const id = useId();
  const read = useCallback(
    async (api: Api) => {
      const catalog = (await api.module.listCatalog({ profileId })).modules;
      const digests = new Map(catalog.map((module) => [module.moduleId, module.packageDigest]));
      return cardsOf(
        views,
        moduleIds.map((moduleId) => ({ moduleId, packageDigest: digests.get(moduleId) ?? "" })),
      );
    },
    [views, profileId, moduleIds],
  );
  const cards = useRequest(read);
  const [connected, setConnected] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  // The line of a module connected takes the focus its button had.
  const done = useRef<string | undefined>(undefined);
  useEffect(() => {
    const moduleId = done.current;
    if (moduleId === undefined) return;
    done.current = undefined;
    document.querySelector<HTMLElement>(`[data-connected="${CSS.escape(moduleId)}"]`)?.focus();
  });
  const connect = useCallback(
    (moduleId: string) => {
      setPending(true);
      setFailure(undefined);
      api.module
        .connectModule({ profileId, moduleId })
        .then(
          () => {
            done.current = moduleId;
            setConnected((held) => new Set([...held, moduleId]));
            onConnected();
          },
          (reason: unknown) => setFailure(parseFailure(reason)),
        )
        .finally(() => setPending(false));
    },
    [api, profileId, onConnected],
  );
  let shown = null;
  if (cards.status === "failed") {
    shown = <ReadFailure failure={cards.failure} onRetry={cards.retry} />;
  } else if (cards.status === "done") {
    shown = (
      <ModuleCardList
        cards={cards.value}
        onRetry={cards.retry}
        render={(card) =>
          connected.has(card.moduleId) ? (
            <li key={card.moduleId} className="nt-card">
              <CardHeading card={card} id={`${id}-${card.moduleId}`} />
              <p data-connected={card.moduleId} tabIndex={-1}>
                {words.text("skillmap.connected")}
              </p>
            </li>
          ) : (
            <ModuleCardItem
              key={card.moduleId}
              card={card}
              {...(card.digest === undefined
                ? {}
                : {
                    action: {
                      text: words.text("subjects.connect"),
                      pending,
                      onPress: () => connect(card.moduleId),
                    },
                  })}
            />
          )
        }
      />
    );
  }
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{words.text("skillmap.offered-title")}</h2>
      <p>{words.text("skillmap.offered-text")}</p>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      {shown}
    </section>
  );
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | {
      readonly status: "done";
      readonly map: ModuleMap;
      /** The modules offered when the map was read: a module connected meanwhile stays on. */
      readonly offered: readonly string[];
    };

/** `#/skill-map/<module>`: the module's map, the choice of a skill on it, and the modules offered. */
function MapOfModule({
  profileId,
  moduleId,
  device,
}: {
  readonly profileId: string;
  readonly moduleId: string;
  readonly device: Device | undefined;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const { views } = usePackages();
  const open = useAttempt()?.attemptId;
  const { choose, act } = useEngine(profileId, device);
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the map again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    readModuleMap(api, views, { profileId, moduleId, action: Action.LEARNING }).then(
      (map) => {
        if (current) setRead({ status: "done", map, offered: offeredModules(map.skillMap) });
      },
      (reason: unknown) => {
        if (current) setRead({ status: "failed", failure: parseFailure(reason) });
      },
    );
    return () => {
      current = false;
    };
  }, [api, views, profileId, moduleId, attempt]);

  // Once a module is connected, the state is read again in place: a read that fails leaves the map
  // as it was, and the next opening reads it anew.
  const refresh = useCallback(() => {
    void api.progress.getSkillMap({ profileId, moduleId, action: Action.LEARNING }).then(
      (skillMap) =>
        setRead((held) =>
          held.status === "done" && held.map.skillMap.packageDigest === skillMap.packageDigest
            ? { ...held, map: { ...held.map, skillMap } }
            : held,
        ),
      () => {},
    );
  }, [api, profileId, moduleId]);

  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [nothing, setNothing] = useState<EngineChoice | undefined>(undefined);
  /** The skill asked for while an attempt is open, and the button that asked. */
  const [confirming, setConfirming] = useState<
    { readonly skill: string; readonly from: HTMLElement | undefined } | undefined
  >(undefined);
  const goOn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming !== undefined) goOn.current?.focus();
  }, [confirming]);

  const run = useCallback(
    (skill: string) => {
      setPending(true);
      // The attempt open now is the one the choice closes, whatever happens to the screen meanwhile.
      const leaving = open;
      void (async () => {
        try {
          const given = await choose(skill, leaving);
          if (given === undefined) return;
          if (givenOf(given) === "nothing") setNothing(given);
          else await act(given, undefined);
        } catch (reason) {
          setFailure(parseFailure(reason));
        }
      })().finally(() => setPending(false));
    },
    [open, choose, act],
  );

  const chosen = useCallback(
    (skill: string, from: HTMLElement | undefined) => {
      if (pending) return;
      setFailure(undefined);
      setNothing(undefined);
      if (open !== undefined) setConfirming({ skill, from });
      else run(skill);
    },
    [pending, open, run],
  );

  const map = read.status === "done" ? read.map : undefined;
  const outcome = nothing === undefined ? undefined : outcomeOf(nothing.outcome);
  return (
    <Screen title={mapTitle(map, words)} heading={<MapHeading map={map} />}>
      <Ways all />
      {read.status === "failed" ? <ReadFailure failure={read.failure} onRetry={retry} /> : null}
      {read.status === "done" ? (
        <>
          <p>{words.text("skillmap.hint")}</p>
          {/* A press of Practise while a choice is under way does nothing, and this line says why. */}
          {/* The strings have no full stop of their own: two in one line are two sentences. */}
          <p role="status" className="nt-hint">
            {[
              pending ? words.text("skillmap.choosing") : "",
              nothing === undefined ? "" : words.text("next.nothing"),
              outcome === undefined ? "" : outcomeText(outcome, words),
            ]
              .filter((sentence) => sentence !== "")
              .join(". ")}
          </p>
          {failure === undefined ? null : (
            <p role="alert" className="nt-error">
              {failureText(failure, words)}
            </p>
          )}
          {confirming === undefined ? null : (
            <fieldset className="nt-buttons">
              <legend>{words.text("next.else-confirm")}</legend>
              <button
                ref={goOn}
                type="button"
                onClick={() => {
                  // The question goes, and the focus goes back to Practise, as on Cancel: a choice
                  // that gives nothing or fails leaves the learner where they asked.
                  setConfirming(undefined);
                  if (confirming.from?.isConnected === true) confirming.from.focus();
                  run(confirming.skill);
                }}
              >
                {words.text("next.else-go")}
              </button>
              <button
                type="button"
                className="nt-secondary"
                onClick={() => {
                  setConfirming(undefined);
                  if (confirming.from?.isConnected === true) confirming.from.focus();
                }}
              >
                {words.text("common.cancel")}
              </button>
            </fieldset>
          )}
          {read.offered.length === 0 ? null : (
            <Offered profileId={profileId} moduleIds={read.offered} onConnected={refresh} />
          )}
          <ModuleSkillMap map={read.map} view="learner" headingLevel="2" onChoose={chosen} />
        </>
      ) : null}
    </Screen>
  );
}

/** The screens of the skill map, by the route; a route of more parts goes to the list in place. */
export function SkillMapRoute({
  route,
  profileId,
  device,
}: {
  readonly route: Route;
  readonly profileId: string;
  /** The device, whose database an attempt closed goes from; none in a screen's own test. */
  readonly device?: Device;
}) {
  const known = route.parts.length <= 1;
  useEffect(() => {
    if (!known) redirect(SKILL_MAP);
  }, [known]);
  if (!known) return null;
  const moduleId = route.parts[0];
  if (moduleId === undefined) return <MapList profileId={profileId} />;
  return <MapOfModule key={moduleId} profileId={profileId} moduleId={moduleId} device={device} />;
}
