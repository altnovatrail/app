// The page Own AI key in the section for adults (the contract), drawn as a device's settings: the
// owner connects, replaces and removes their own key at an AI provider. It works while the owner
// profile of the category `adult` is the learner chosen: with none chosen, it opens that profile —
// no PIN while the account has no child. The providers are those `ListOwnKeyProviders` gives, with
// no list of the build's own; with none, the page says so and has no field. "Connect" asks
// `CheckOwnKey`, and only a key it accepted takes the place of the former one; the key is shown by
// its provider and last four characters alone, never whole, and lives in no state of the page but
// its field. "Keep on this device" is off until the adult sets it. A refusal of the key stays beside
// it with what to do, and its limit reached with which limit, when access comes back if api says,
// and what to do about that limit; "Remove key" is the one way to platform AI, and the owner's.
// Under it all, a group says in words what happens to the key. In the device's language, as the
// section is.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { OwnKeyCheck } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, LimitCause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure } from "../api/failure.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { failureText, outcomeText } from "../api/words.ts";
import { described } from "../app/described.ts";
import { ADULTS, type Route } from "../app/router.ts";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { HeldKey, KeyRefusal } from "../ownkey/holder.ts";
import { keyed, useHeldKey, useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { ActionRow, ChoiceRow, Group, InfoRow, SwitchRow } from "./rows.tsx";
import { SectionScreen } from "./SectionScreen.tsx";

/** The page Own AI key. */
export const OWN_KEY_PAGE: Route = { screen: ADULTS.screen, parts: ["own-key"] };

/** The words of a check that did not accept the key, by its answer; an unknown one did not go. */
const CHECK_KEYS = {
  [OwnKeyCheck.INVALID]: "ownkey.invalid",
  [OwnKeyCheck.NO_PERMISSION]: "ownkey.no-permission",
  [OwnKeyCheck.PROVIDER_CLOSED]: "ownkey.provider-closed",
  [OwnKeyCheck.UNSPECIFIED]: "ownkey.check-failed",
} as const;

/** What happens to the key: four rows in words, with no links. */
function About() {
  const { words } = useLanguage();
  return (
    <Group title={words.text("ownkey.about")} className="nt-set-about">
      <InfoRow
        icon="set-server"
        tile="blue"
        label={words.text("ownkey.server")}
        sub={words.text("ownkey.server-line")}
      />
      <InfoRow
        icon="set-card"
        tile="green"
        label={words.text("ownkey.billing")}
        sub={words.text("ownkey.billing-line")}
      />
      <InfoRow
        icon="set-lock"
        tile="grey"
        label={words.text("ownkey.not-protected")}
        sub={words.text("ownkey.not-protected-line")}
      />
      <InfoRow
        icon="set-limit"
        tile="orange"
        label={words.text("ownkey.limits")}
        sub={words.text("ownkey.limits-line")}
      />
    </Group>
  );
}

/** A group of one row of words, and the action it leads to where it has one. */
function Said({ text, children }: { readonly text: string; readonly children?: ReactNode }) {
  return (
    <Group>
      <div className="nt-set-row nt-set-lines">
        <p>{text}</p>
      </div>
      {children}
    </Group>
  );
}

/**
 * A new key: the provider and the key in one group, the mark in its own, and Connect, which checks
 * it. Connect stays grey until a key is typed, and pressed then it says what is missing. A key not
 * accepted changes nothing; one accepted takes the place of the former one, and its field is emptied.
 */
function NewKey({
  profileId,
  onConnected,
  onCancel,
}: {
  readonly profileId: string;
  /** The key accepted is connected: back to the key connected, when this one replaces it. */
  readonly onConnected?: () => void;
  /** Back to the key connected, when this one replaces it. */
  readonly onCancel?: () => void;
}) {
  const api = useApi();
  const holder = useKeyHolder();
  const { words } = useLanguage();
  const id = useId();
  const read = useCallback(
    async (api: Api) => (await api.account.listOwnKeyProviders({ profileId })).providers,
    [profileId],
  );
  const providers = useRequest(read);
  const providerField = useRef<HTMLButtonElement>(null);
  // The key is in its field alone, never in the page's state: the page knows only that one is typed.
  const keyField = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(false);
  const [chosen, setChosen] = useState("");
  const [keep, setKeep] = useState(false);
  const [providerError, setProviderError] = useState(false);
  const [keyError, setKeyError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const list = providers.status === "done" ? providers.value : [];
  // One provider is chosen already; of several, the adult chooses.
  const only = list.length === 1 ? (list[0]?.provider ?? "") : "";
  const provider = chosen === "" ? only : chosen;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const key = keyField.current?.value.trim() ?? "";
    const given = list.find((each) => each.provider === provider);
    setProviderError(given === undefined);
    setKeyError(key === "" ? words.text("ownkey.key-needed") : undefined);
    setFailure(undefined);
    if (given === undefined) return providerField.current?.focus();
    if (key === "") return keyField.current?.focus();
    setPending(true);
    try {
      const answer = await api.account.checkOwnKey({
        profileId,
        ownKey: { provider: given.provider, key },
      });
      if (answer.check === OwnKeyCheck.ACCEPTED) {
        // The field is emptied before the key connected takes the page's place.
        if (keyField.current !== null) keyField.current.value = "";
        onConnected?.();
        await holder.connect(profileId, { provider: given.provider, name: given.name, key }, keep);
        return;
      }
      // An answer this build does not know is a check that did not go through (contract).
      const said = keyFor(CHECK_KEYS, answer.check);
      setKeyError(words.text(said === "common.unknown" ? "ownkey.check-failed" : said));
      keyField.current?.focus();
    } catch (reason) {
      setFailure(parseFailure(reason));
    } finally {
      setPending(false);
    }
  }

  if (providers.status === "loading") {
    const row = (label: string, end?: ReactNode) => (
      <div className="nt-set-row">
        <Sk width={label} height="1rem" radius="0.3125rem" />
        {end}
      </div>
    );
    return (
      <Loading>
        <div className="nt-set-sec">
          <div className="nt-set-group">
            {row("5rem", <Sk width="6rem" height="1rem" radius="0.3125rem" />)}
            {row("3rem")}
          </div>
        </div>
        <div className="nt-set-sec">
          <div className="nt-set-group">
            {row("11rem", <Sk width="3.1875rem" height="1.9375rem" radius="1rem" />)}
          </div>
        </div>
        <div className="nt-set-sec">
          <div className="nt-set-group">{row("5rem")}</div>
        </div>
      </Loading>
    );
  }
  if (providers.status === "failed") {
    return <ReadFailure failure={providers.failure} onRetry={providers.retry} />;
  }
  if (list.length === 0) return <Said text={words.text("ownkey.no-providers")} />;
  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <Group
        note={
          <>
            <p>{words.text(onCancel === undefined ? "ownkey.hint" : "ownkey.replace-hint")}</p>
            {providerError ? (
              <p id={`${id}-provider-error`} className="nt-error">
                {words.text("ownkey.provider-choose")}
              </p>
            ) : null}
            {keyError === undefined ? null : (
              <p id={`${id}-key-error`} className="nt-error">
                {keyError}
              </p>
            )}
          </>
        }
      >
        <ChoiceRow
          label={words.text("ownkey.provider")}
          options={list.map((each) => [each.provider, each.name] as const)}
          value={provider === "" ? undefined : provider}
          shown={words.text("ownkey.provider-none")}
          describedBy={described(providerError && `${id}-provider-error`)}
          buttonRef={providerField}
          onChange={setChosen}
        />
        <div className="nt-set-row nt-set-field">
          <label htmlFor={`${id}-key`} className="nt-set-label">
            {words.text("ownkey.key")}
          </label>
          <input
            ref={keyField}
            id={`${id}-key`}
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={words.text("ownkey.key-placeholder")}
            aria-invalid={keyError !== undefined}
            aria-describedby={described(keyError !== undefined && `${id}-key-error`)}
            onInput={(event) => setTyped(event.currentTarget.value.trim() !== "")}
          />
        </div>
      </Group>
      <Group
        note={<p id={`${id}-keep-hint`}>{words.text(keep ? "ownkey.kept" : "ownkey.keep-hint")}</p>}
      >
        <SwitchRow
          label={words.text("ownkey.keep")}
          checked={keep}
          describedBy={`${id}-keep-hint`}
          onChange={setKeep}
        />
      </Group>
      <Group>
        <ActionRow submit label={words.text("ownkey.connect")} off={pending || !typed} />
        {onCancel === undefined ? null : (
          <ActionRow label={words.text("common.cancel")} onPress={onCancel} />
        )}
      </Group>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error nt-set-alert">
          {failureText(failure, words)}
        </p>
      )}
    </form>
  );
}

/** What to do about a limit of the key, by which one ran out; one not named, or unknown, at large. */
const LIMIT_STEPS = {
  [LimitCause.LIMIT]: "ownkey.limit-spend",
  [LimitCause.TIER]: "ownkey.limit-tier",
  [LimitCause.BALANCE]: "ownkey.limit-balance",
  [LimitCause.PAYMENT]: "ownkey.limit-payment",
} as const;

/**
 * What to do about the last refusal of the key; or its limit — the task's line of it, with when
 * access comes back if api said, and then what to do about that limit, each a paragraph.
 */
function Refusal({ refusal }: { readonly refusal: KeyRefusal }) {
  const { words } = useLanguage();
  if (refusal.cause === Cause.KEY_REFUSED) {
    return <p className="nt-error">{words.text("ownkey.refused")}</p>;
  }
  const step = keyFor(LIMIT_STEPS, refusal.ownKeyLimit?.cause ?? -1, "ownkey.limit");
  return (
    <>
      <p className="nt-error">{outcomeText(refusal, words)}</p>
      <p className="nt-error">{words.text(step)}</p>
    </>
  );
}

/**
 * "Remove key" and its question: asked, the group holds the question, Erase and Cancel, the focus
 * on Erase; answered, the focus goes back to Remove key.
 */
function RemoveKey({ onRemove }: { readonly onRemove: () => Promise<void> }) {
  const { words } = useLanguage();
  const id = useId();
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const remove = useRef<HTMLButtonElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (asking) yes.current?.focus();
    else if (asked.current) remove.current?.focus();
    asked.current = asking;
  }, [asking]);
  const note = <p>{words.text("ownkey.remove-hint")}</p>;
  if (!asking) {
    return (
      <Group note={note}>
        <ActionRow
          danger
          label={words.text("ownkey.remove")}
          buttonRef={remove}
          onPress={() => setAsking(true)}
        />
      </Group>
    );
  }
  return (
    <Group note={note}>
      <div className="nt-set-row nt-set-lines">
        <p id={`${id}-question`}>{words.text("ownkey.remove-confirm")}</p>
      </div>
      {/* Not disabled while it is under way: a disabled button would drop the focus. */}
      <ActionRow
        danger
        label={words.text("device.erase")}
        off={pending}
        describedBy={`${id}-question`}
        buttonRef={yes}
        onPress={() => {
          if (pending) return;
          setPending(true);
          void onRemove().finally(() => {
            setPending(false);
            setAsking(false);
          });
        }}
      />
      <ActionRow label={words.text("common.cancel")} onPress={() => setAsking(false)} />
    </Group>
  );
}

/**
 * The key connected: its provider and last four, with a refusal of it or its limit; where it lives;
 * its replacement; and its removal.
 */
function Connected({
  profileId,
  held,
  refusal,
}: {
  readonly profileId: string;
  readonly held: HeldKey;
  readonly refusal: KeyRefusal | undefined;
}) {
  const holder = useKeyHolder();
  const { words } = useLanguage();
  const id = useId();
  const [replacing, setReplacing] = useState(false);
  const [pending, setPending] = useState(false);
  if (replacing) {
    return (
      <NewKey
        profileId={profileId}
        onConnected={() => setReplacing(false)}
        onCancel={() => setReplacing(false)}
      />
    );
  }
  return (
    <>
      <Group
        note={
          <>
            {refusal === undefined ? null : <Refusal refusal={refusal} />}
            <p>{words.text("ownkey.connected-hint")}</p>
          </>
        }
      >
        <InfoRow
          status
          icon="set-key"
          tile="orange"
          label={held.name}
          sub={words.text("ownkey.ending", { last4: held.last4 })}
        />
      </Group>
      <Group
        note={
          <>
            <p id={`${id}-keep-hint`}>
              {words.text(held.kept ? "ownkey.kept" : "ownkey.in-memory")}
            </p>
            {held.unsaved ? (
              <p role="alert" className="nt-error">
                {words.text("ownkey.not-saved")}
              </p>
            ) : null}
          </>
        }
      >
        <SwitchRow
          label={words.text("ownkey.keep")}
          checked={held.kept}
          busy={pending}
          describedBy={`${id}-keep-hint`}
          onChange={(keep) => {
            setPending(true);
            void holder.setKeep(profileId, keep).finally(() => setPending(false));
          }}
        />
      </Group>
      <Group note={<p>{words.text("ownkey.replace-hint")}</p>}>
        <ActionRow label={words.text("ownkey.replace")} onPress={() => setReplacing(true)} />
      </Group>
      <RemoveKey onRemove={() => holder.remove(profileId)} />
    </>
  );
}

export function OwnKeyPage({
  profiles,
  onOpenOwner,
}: {
  /** The profiles of the account, as the session has them now. */
  readonly profiles: readonly Profile[];
  /** Opens the owner profile as the learner, when none is chosen. */
  readonly onOpenOwner?: () => void;
}) {
  const { words } = useLanguage();
  const state = useHeldKey();
  const owner = profiles.find(keyed);
  const open =
    owner !== undefined && state.status === "open" && state.profileId === owner.profileId;
  // A key removed — here, on This device or in another tab — says so once.
  const [removed, setRemoved] = useState(false);
  const had = useRef(false);
  const held = open && state.status === "open" ? state.key : undefined;
  useEffect(() => {
    if (had.current && held === undefined) setRemoved(true);
    if (held !== undefined) setRemoved(false);
    had.current = held !== undefined;
  }, [held]);
  let shown: ReactNode;
  if (owner === undefined) shown = <Said text={words.text("ownkey.no-profile")} />;
  else if (open && state.status === "open") {
    shown =
      state.key === undefined ? (
        <NewKey profileId={owner.profileId} />
      ) : (
        <Connected
          key={`${state.key.provider} ${state.key.last4}`}
          profileId={owner.profileId}
          held={state.key}
          refusal={state.refusal}
        />
      );
  } else if (state.status !== "opening") {
    shown = (
      <Said text={words.text("ownkey.not-open")}>
        {onOpenOwner === undefined ? null : (
          <ActionRow label={words.text("ownkey.open-profile")} onPress={onOpenOwner} />
        )}
      </Said>
    );
  }
  return (
    <SectionScreen title={words.text("ownkey.title")}>
      <p role="status" className="nt-hidden-label">
        {removed ? words.text("ownkey.removed") : null}
      </p>
      {shown}
      <About />
    </SectionScreen>
  );
}
