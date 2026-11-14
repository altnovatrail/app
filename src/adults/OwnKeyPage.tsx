// The page Own AI key in the section for adults (R08 and R47 in docs/decisions.md; section 3.6 of
// docs/architecture.md; section 15 of the text of the contracts): the owner connects, replaces and
// removes their own key at an AI provider. It works while the owner profile of the category
// `adult` is the learner chosen: with none chosen, it opens that profile — no PIN while the account
// has no child. Before the field it says in words what happens to the key. The providers are those
// `ListOwnKeyProviders` gives, with no list of the build's own; with none, the page says so and has
// no field. "Connect" asks `CheckOwnKey`, and only a key it accepted takes the place of the former
// one; the key is shown by its provider and last four characters alone, never whole, and lives in
// no state of the page but its field. "Keep on this device" is off until the adult sets it. A
// refusal of the key, or its limit reached, stays beside it with what to do; "Remove key" is the
// one way to platform AI, and the owner's. In the device's language, as the section is (R10).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { OwnKeyCheck } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
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
import { failureText } from "../api/words.ts";
import { described } from "../app/described.ts";
import { ADULTS, type Route } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { HeldKey, KeyRefusal } from "../ownkey/holder.ts";
import { keyed, useHeldKey, useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { Erase } from "./DevicePage.tsx";

/** The page Own AI key (R08; section 3.6). */
export const OWN_KEY_PAGE: Route = { screen: ADULTS.screen, parts: ["own-key"] };

/** The words of a check that did not accept the key, by its answer; an unknown one did not go. */
const CHECK_KEYS = {
  [OwnKeyCheck.INVALID]: "ownkey.invalid",
  [OwnKeyCheck.NO_PERMISSION]: "ownkey.no-permission",
  [OwnKeyCheck.PROVIDER_CLOSED]: "ownkey.provider-closed",
  [OwnKeyCheck.UNSPECIFIED]: "ownkey.check-failed",
} as const;

/** What the page says before the field, in words and with no links (privacy 1, 7 in spec). */
function Warning() {
  const { words } = useLanguage();
  return (
    <>
      <p>{words.text("ownkey.server")}</p>
      <p>{words.text("ownkey.billing")}</p>
      <p>{words.text("ownkey.not-protected")}</p>
      <p>{words.text("ownkey.limits")}</p>
    </>
  );
}

/**
 * A new key: the provider, the field and the mark, and its check. A key not accepted changes
 * nothing; one accepted takes the place of the former one, and its field is emptied.
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
  const providerField = useRef<HTMLSelectElement>(null);
  // The key is in its field alone, never in the page's state.
  const keyField = useRef<HTMLInputElement>(null);
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

  if (providers.status === "loading") return null;
  if (providers.status === "failed") {
    return <ReadFailure failure={providers.failure} onRetry={providers.retry} />;
  }
  if (list.length === 0) return <p>{words.text("ownkey.no-providers")}</p>;
  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <div className="nt-field">
        <label htmlFor={`${id}-provider`}>{words.text("ownkey.provider")}</label>
        <select
          ref={providerField}
          id={`${id}-provider`}
          value={provider}
          aria-invalid={providerError}
          aria-describedby={described(providerError && `${id}-provider-error`)}
          onChange={(event) => setChosen(event.target.value)}
        >
          {only === "" ? <option value="">{words.text("ownkey.provider-choose")}</option> : null}
          {list.map((each) => (
            <option key={each.provider} value={each.provider}>
              {each.name}
            </option>
          ))}
        </select>
        {providerError ? (
          <p id={`${id}-provider-error`} className="nt-error">
            {words.text("ownkey.provider-choose")}
          </p>
        ) : null}
      </div>
      <div className="nt-field">
        <label htmlFor={`${id}-key`}>{words.text("ownkey.key")}</label>
        <input
          ref={keyField}
          id={`${id}-key`}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={keyError !== undefined}
          aria-describedby={described(keyError !== undefined && `${id}-key-error`)}
        />
        {keyError === undefined ? null : (
          <p id={`${id}-key-error`} className="nt-error">
            {keyError}
          </p>
        )}
      </div>
      <div className="nt-field">
        <div className="nt-check">
          <input
            id={`${id}-keep`}
            type="checkbox"
            checked={keep}
            aria-describedby={`${id}-keep-hint`}
            onChange={(event) => setKeep(event.target.checked)}
          />
          <label htmlFor={`${id}-keep`}>{words.text("ownkey.keep")}</label>
        </div>
        <p id={`${id}-keep-hint`} className="nt-hint">
          {words.text("ownkey.keep-hint")}
        </p>
      </div>
      <div className="nt-buttons">
        <button type="submit" disabled={pending}>
          {words.text("ownkey.connect")}
        </button>
        {onCancel === undefined ? null : (
          <button type="button" className="nt-secondary" onClick={onCancel}>
            {words.text("common.cancel")}
          </button>
        )}
      </div>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
    </form>
  );
}

/** What to do about the last refusal of the key, or its limit. */
function Refusal({ refusal }: { readonly refusal: KeyRefusal }) {
  const { words } = useLanguage();
  return (
    <p className="nt-error">
      {words.text(refusal.cause === Cause.KEY_REFUSED ? "ownkey.refused" : "ownkey.limit")}
    </p>
  );
}

/** The key connected: its provider and last four, where it lives, and its replacement or removal. */
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
      <>
        <p id={`${id}-replace`}>{words.text("ownkey.replace-hint")}</p>
        <NewKey
          profileId={profileId}
          onConnected={() => setReplacing(false)}
          onCancel={() => setReplacing(false)}
        />
      </>
    );
  }
  return (
    <>
      <p role="status">
        {words.text("ownkey.connected", { provider: held.name, last4: held.last4 })}
      </p>
      {refusal === undefined ? null : <Refusal refusal={refusal} />}
      <div className="nt-field">
        <div className="nt-check">
          <input
            id={`${id}-keep`}
            type="checkbox"
            checked={held.kept}
            aria-disabled={pending}
            aria-describedby={`${id}-keep-hint`}
            onChange={(event) => {
              if (pending) return;
              const keep = event.target.checked;
              setPending(true);
              void holder.setKeep(profileId, keep).finally(() => setPending(false));
            }}
          />
          <label htmlFor={`${id}-keep`}>{words.text("ownkey.keep")}</label>
        </div>
        <p id={`${id}-keep-hint`} className="nt-hint">
          {words.text(held.kept ? "ownkey.kept" : "ownkey.in-memory")}
        </p>
        {held.unsaved ? (
          <p role="alert" className="nt-error">
            {words.text("ownkey.not-saved")}
          </p>
        ) : null}
      </div>
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={() => setReplacing(true)}>
          {words.text("ownkey.replace")}
        </button>
      </div>
      <p>{words.text("ownkey.remove-hint")}</p>
      <Erase
        label={words.text("ownkey.remove")}
        question={words.text("ownkey.remove-confirm")}
        onErase={() => holder.remove(profileId)}
      />
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
  if (owner === undefined) shown = <p>{words.text("ownkey.no-profile")}</p>;
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
      <>
        <p>{words.text("ownkey.not-open")}</p>
        {onOpenOwner === undefined ? null : (
          <div className="nt-buttons">
            <button type="button" onClick={onOpenOwner}>
              {words.text("ownkey.open-profile")}
            </button>
          </div>
        )}
      </>
    );
  }
  return (
    <Screen title={words.text("ownkey.title")}>
      <Warning />
      {shown}
      <p role="status">{removed ? words.text("ownkey.removed") : null}</p>
    </Screen>
  );
}
