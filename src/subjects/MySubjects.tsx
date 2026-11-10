// "My subjects", the learner's home (sections 3.8, 3.9 and 3.10 of docs/architecture.md; R99 in
// spec): the modules connected to the profile and, below them, the catalog of the ones it may
// connect, each a card with its title in its own explanation language and, when that is not the
// screen's, a line that names it, in the order of the screen's language. Connecting and
// disconnecting are a press away; api's answer is the list of connected modules, and the focus goes
// with the card to its new place. What comes next of a module — its lesson, chosen by engine — is
// T27's and T28's.
import type { ConnectedModule } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Screen } from "../app/Screen.tsx";
import { Offline } from "../boot/Screens.tsx";
import { collator, languageNames } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Language } from "../i18n/language.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import { byTitle, cardsOf, type ModuleCard, type ModuleRef } from "./modules.ts";

/** Whether a language tag is the screen's language, by its primary subtag. */
function isScreenLanguage(tag: string, language: Language): boolean {
  return tag.split("-")[0]?.toLowerCase() === language;
}

/** A language's name in the screen's language; a tag Intl cannot read stands for itself. */
function nameOf(tag: string, language: Language): string {
  try {
    return languageNames(language).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** What a card's button does. */
type Action = "connect" | "disconnect";

/** A module's card, its button described by its title. */
function Card({
  card,
  action,
  pending,
  onPress,
}: {
  readonly card: ModuleCard;
  readonly action: Action;
  readonly pending: boolean;
  readonly onPress: (moduleId: string) => void;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const explanation = card.language;
  return (
    <li className="nt-card">
      <article aria-labelledby={id}>
        <h3 id={id} {...(explanation === undefined ? {} : { lang: explanation })}>
          {card.title}
        </h3>
        {explanation === undefined || isScreenLanguage(explanation, language) ? null : (
          <p>
            {words.text("subjects.explanation-language", {
              language: nameOf(explanation, language),
            })}
          </p>
        )}
        {card.digest === undefined ? <p>{words.text("subjects.unavailable")}</p> : null}
        <div className="nt-buttons">
          {/* Not disabled while a press is under way: a disabled button would drop the focus. */}
          <button
            type="button"
            className={action === "disconnect" ? "nt-secondary" : undefined}
            aria-describedby={id}
            aria-disabled={pending}
            data-module={card.moduleId}
            data-action={action}
            onClick={() => {
              if (!pending) onPress(card.moduleId);
            }}
          >
            {words.text(action === "connect" ? "subjects.connect" : "subjects.disconnect")}
          </button>
        </div>
      </article>
    </li>
  );
}

export interface SubjectsScreenProps {
  /** The modules connected, as cards; none while they come. */
  readonly connected: readonly ModuleCard[] | undefined;
  /** The catalog's modules, connected ones too; none while they come. */
  readonly catalog: readonly ModuleCard[] | undefined;
  /** What the last connection or disconnection came to, when it did not answer. */
  readonly failure?: Failure;
  /** A connection or disconnection under way. */
  readonly pending?: boolean;
  readonly onConnect: (moduleId: string) => void;
  readonly onDisconnect: (moduleId: string) => void;
  /** Asks for the lists again: offered when the names of some modules did not come. */
  readonly onRetry?: () => void;
}

/** The screen itself, from what its container has read. */
export function SubjectsScreen({
  connected,
  catalog,
  failure,
  pending = false,
  onConnect,
  onDisconnect,
  onRetry,
}: SubjectsScreenProps) {
  const { language, words } = useLanguage();
  const connectedId = useId();
  const catalogId = useId();
  const compare = useMemo(() => collator(language).compare, [language]);
  const own = new Set(connected?.map((card) => card.moduleId));
  const mine = connected === undefined ? undefined : byTitle(connected, compare);
  const more =
    catalog === undefined
      ? undefined
      : byTitle(
          catalog.filter((card) => !own.has(card.moduleId)),
          compare,
        );
  const unnamed = [...(mine ?? []), ...(more ?? [])].some((card) => card.unnamed === true);
  return (
    <Screen title={words.text("subjects.title")}>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      {unnamed && onRetry !== undefined ? (
        <div role="status">
          <p>{words.text("subjects.unnamed")}</p>
          <button type="button" onClick={onRetry}>
            {words.text("boot.retry")}
          </button>
        </div>
      ) : null}
      <section aria-labelledby={connectedId}>
        <h2 id={connectedId}>{words.text("subjects.connected")}</h2>
        {mine === undefined ? null : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-cards">
            {mine.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="disconnect"
                pending={pending}
                onPress={onDisconnect}
              />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={catalogId}>
        <h2 id={catalogId}>{words.text("subjects.catalog")}</h2>
        {more === undefined ? null : more.length === 0 ? (
          <p>{words.text("subjects.catalog-empty")}</p>
        ) : (
          <ul className="nt-cards">
            {more.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="connect"
                pending={pending}
                onPress={onConnect}
              />
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "done"; readonly connected: ModuleCard[]; readonly catalog: ModuleCard[] };

/** The key of a module at a version: a module in both lists is one card. */
const keyOf = (module: ModuleRef) => `${module.moduleId} ${module.packageDigest}`;

/** "My subjects" of the learner chosen: what api says is connected and in the catalog. */
export function MySubjects({ profileId }: { readonly profileId: string }) {
  const api = useApi();
  const { views } = usePackages();
  const { words } = useLanguage();
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  // The button the focus goes to once a card has moved: its own, in its new list.
  const focus = useRef<{ moduleId: string; action: Action } | undefined>(undefined);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the lists again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    void Promise.all([
      api.module.listConnectedModules({ profileId }),
      api.module.listCatalog({ profileId }),
    ])
      .then(async ([own, catalog]) => {
        // One card for a module in both lists: its manifest is read once.
        const all = new Map<string, ModuleRef>();
        for (const module of [...own.modules, ...catalog.modules]) all.set(keyOf(module), module);
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
  }, [api, views, profileId, attempt]);

  // Once a card has moved, its button in the new list takes the focus the old one had.
  useEffect(() => {
    const target = focus.current;
    if (target === undefined || read.status !== "done") return;
    focus.current = undefined;
    document
      .querySelector<HTMLButtonElement>(
        `button[data-module="${CSS.escape(target.moduleId)}"][data-action="${target.action}"]`,
      )
      ?.focus();
  });

  // api answers with the modules connected: they become the list, the catalog stays.
  const change = useCallback(
    async (moduleId: string, then: Action, call: () => Promise<{ modules: ConnectedModule[] }>) => {
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

  if (read.status === "failed") {
    if (read.failure.kind === "offline") return <Offline onRetry={retry} />;
    return (
      <Screen title={failureText(read.failure, words)}>
        <button type="button" onClick={retry}>
          {words.text("boot.retry")}
        </button>
      </Screen>
    );
  }
  const done = read.status === "done";
  return (
    <SubjectsScreen
      connected={done ? read.connected : undefined}
      catalog={done ? read.catalog : undefined}
      {...(failure === undefined ? {} : { failure })}
      pending={pending}
      onRetry={retry}
      onConnect={(moduleId) =>
        void change(moduleId, "disconnect", () => api.module.connectModule({ profileId, moduleId }))
      }
      onDisconnect={(moduleId) =>
        void change(moduleId, "connect", () => api.module.disconnectModule({ profileId, moduleId }))
      }
    />
  );
}
