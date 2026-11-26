// The page Own AI key in the browser, with api on connect-es's router and the storage
// on the engine's own IndexedDB: the words under the form, the providers api gives and none, the
// five answers of the check and one this build does not know, a key not accepted that leaves the
// former one, the key shown by its last four alone, the mark that keeps it on the device and the
// key in none of the browser's storages without it, its replacement and removal, a refusal beside
// it, its limit with which one ran out, when access comes back and what to do, the account's checks
// exhausted with when the next one opens, and the owner profile opened from the page.
import {
  AccountService,
  type CheckOwnKeyRequest,
  type CheckOwnKeyResponseSchema,
  OwnKeyCheck,
  type Profile,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  Cause,
  LimitCause,
  OwnKeyLimitSchema,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import { KeyHolder } from "../ownkey/holder.ts";
import { KeyHolderProvider } from "../ownkey/OwnKeyContext.tsx";
import { browserDevice } from "../storage/browser.ts";
import { indexedDbBackend } from "../storage/idb.ts";
import { deviceKeyStore, type KeyStore, keptKey } from "../storage/ownkey.ts";
import { setAccount } from "../storage/registry.ts";
import { inLanguage } from "../test/language.tsx";
import { expectLoaded, expectLoading, held } from "../test/loading.ts";
import { OwnKeyPage } from "./OwnKeyPage.tsx";

const OWNER = create(ProfileSchema, {
  profileId: "p1",
  owner: true,
  pseudonym: "Ёжик",
  ageCategory: "adult",
});
// Synthetic keys: no provider issued them.
const KEY = "sk-ant-synthetic-0000-a1b2";
const NEXT = "sk-ant-synthetic-1111-c3d4";
const ANTHROPIC = { provider: "anthropic", name: "Anthropic" };
const OPENAI = { provider: "openai", name: "OpenAI" };

type Answer = MessageInitShape<typeof CheckOwnKeyResponseSchema>;

interface Setup {
  readonly profiles?: readonly Profile[];
  readonly providers?: () => (typeof ANTHROPIC)[] | Promise<(typeof ANTHROPIC)[]>;
  /** The answer of the check; accepted when left out. */
  readonly check?: (request: CheckOwnKeyRequest) => Answer;
  /** The owner profile is not open: no learner chosen. */
  readonly closed?: boolean;
  /** The device does not take the key: a full disk. */
  readonly full?: boolean;
}

async function renderPage(setup: Setup = {}) {
  const device = browserDevice();
  await setAccount(device, "account-1");
  const checked: CheckOwnKeyRequest[] = [];
  const listed: string[] = [];
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) => {
          router.service(AccountService, {
            async listOwnKeyProviders(request) {
              listed.push(request.profileId);
              return { providers: (await setup.providers?.()) ?? [ANTHROPIC] };
            },
            checkOwnKey(request) {
              checked.push(request);
              return setup.check?.(request) ?? { check: OwnKeyCheck.ACCEPTED };
            },
          });
        },
        { transport: { interceptors } },
      ),
  });
  const store = deviceKeyStore(device);
  const full: KeyStore = { ...store, keep: async () => "unsaved" };
  const holder = new KeyHolder(setup.full === true ? full : store);
  if (setup.closed !== true) await holder.open("p1");
  const onOpenOwner = vi.fn(() => void holder.open("p1"));
  render(
    inLanguage(
      <ApiProvider value={api}>
        <KeyHolderProvider holder={holder}>
          <OwnKeyPage profiles={setup.profiles ?? [OWNER]} onOpenOwner={onOpenOwner} />
        </KeyHolderProvider>
      </ApiProvider>,
    ),
  );
  return { device, holder, checked, listed, onOpenOwner };
}

const keyField = () => screen.getByLabelText("Key");
const connect = () => screen.getByRole("button", { name: "Connect" });

async function enter(key: string) {
  await userEvent.fill(await screen.findByLabelText("Key"), key);
  await userEvent.click(connect());
}

/** Whether a text is anywhere in the origin's IndexedDB, localStorage or sessionStorage. */
async function stored(text: string): Promise<boolean> {
  for (const { name } of await indexedDB.databases()) {
    if (name === undefined) continue;
    const found = await new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const stores = [...db.objectStoreNames];
        if (stores.length === 0) {
          db.close();
          resolve(false);
          return;
        }
        const tx = db.transaction(stores, "readonly");
        const values: unknown[] = [];
        for (const store of stores) {
          const all = tx.objectStore(store).getAll();
          all.onsuccess = () => values.push(...all.result);
        }
        tx.oncomplete = () => {
          db.close();
          resolve(JSON.stringify(values).includes(text));
        };
      };
    });
    if (found) return true;
  }
  const web = [localStorage, sessionStorage].flatMap((storage) =>
    Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
  );
  return web.some((entry) => entry.includes(text));
}

afterEach(async () => {
  cleanup();
  for (const { name } of await indexedDB.databases()) {
    if (name !== undefined) await indexedDbBackend().remove(name);
  }
  localStorage.clear();
  sessionStorage.clear();
});

describe("the page Own AI key", () => {
  it("says what happens to the key under its form, and checks it with no learner's content", async () => {
    const { checked, listed, holder } = await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Own AI key" })).toBeTruthy();
    expect(screen.getByText(/Only while the request runs/)).toBeTruthy();
    expect(screen.getByText("The provider bills your account")).toBeTruthy();
    expect(screen.getByText(/A PIN doesn't protect the key/)).toBeTruthy();
    expect(screen.getByText(/separate OpenAI project with a hard limit/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    // The one provider is chosen already; the field hides what is typed and offers nothing.
    expect(await screen.findByRole("button", { name: "AI provider Anthropic" })).toBeTruthy();
    expect(keyField()).toHaveAttribute("type", "password");
    expect(keyField()).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("switch", { name: "Keep on this device" })).not.toBeChecked();
    await enter(`  ${KEY}  `);
    expect(await screen.findByText("Key ending in a1b2")).toBeTruthy();
    expect(listed).toEqual(["p1"]);
    expect(checked).toHaveLength(1);
    expect(checked[0]?.profileId).toBe("p1");
    expect(checked[0]?.ownKey).toMatchObject({ provider: "anthropic", key: KEY });
    expect(holder.routeFields("p1")).toEqual({ ownKeyProvider: "anthropic" });
    // Shown by its last four alone.
    expect(document.body.textContent).not.toContain(KEY);
    expect(screen.getByText("The key is in this tab's memory alone")).toBeTruthy();
  });

  it("stands with the shapes of its form while the providers are read, busy", async () => {
    const { given, give } = held();
    await renderPage({
      providers: async () => {
        await given;
        return [ANTHROPIC];
      },
    });
    expect(screen.getByRole("heading", { level: 1, name: "Own AI key" })).toBeTruthy();
    expect(screen.queryByLabelText("Key")).toBeNull();
    expectLoading(document, 6);
    give();
    expect(await screen.findByRole("button", { name: "AI provider Anthropic" })).toBeTruthy();
    expectLoaded(document);
  });

  it("keeps the key in none of the browser's storages without the mark, and on the device with it", async () => {
    const { device } = await renderPage();
    await enter(KEY);
    await screen.findByText("Key ending in a1b2");
    expect(await stored(KEY)).toBe(false);
    await userEvent.click(screen.getByRole("switch", { name: "Keep on this device" }));
    await screen.findByText("The key is kept on this device");
    expect(await keptKey(device, "p1")).toMatchObject({ key: KEY, last4: "a1b2" });
    expect(await stored(KEY)).toBe(true);
    // The mark taken off erases it there; memory keeps it.
    await userEvent.click(screen.getByRole("switch", { name: "Keep on this device" }));
    await screen.findByText("The key is in this tab's memory alone");
    expect(await stored(KEY)).toBe(false);
  });

  it("keeps the key on the device when the mark is set before Connect", async () => {
    const { device } = await renderPage();
    await userEvent.click(await screen.findByRole("switch", { name: "Keep on this device" }));
    await enter(KEY);
    await screen.findByText("The key is kept on this device");
    expect(await keptKey(device, "p1")).toMatchObject({ key: KEY });
  });

  it("words each answer of the check that did not accept the key, and connects nothing", async () => {
    const answers: [Answer, string][] = [
      [{ check: OwnKeyCheck.INVALID }, "it isn't valid, or it was revoked"],
      [{ check: OwnKeyCheck.NO_PERMISSION }, "it has no right to the models"],
      [{ check: OwnKeyCheck.PROVIDER_CLOSED }, "doesn't take an own key for your profile"],
      [
        { check: OwnKeyCheck.UNSPECIFIED, outcome: { cause: Cause.AI_FAILURE } },
        "The key couldn't be checked",
      ],
      [{ check: 99 as OwnKeyCheck }, "The key couldn't be checked"],
    ];
    let answer: Answer = { check: OwnKeyCheck.ACCEPTED };
    const { holder } = await renderPage({ check: () => answer });
    for (const [given, words] of answers) {
      answer = given;
      await enter(KEY);
      const error = await screen.findByText(new RegExp(words));
      expect(keyField()).toHaveAccessibleDescription(error.textContent ?? "");
      expect(keyField()).toHaveAttribute("aria-invalid", "true");
      expect(holder.routeFields("p1")).toEqual({});
    }
  });

  it("asks for a provider among several, and for the key", async () => {
    const { checked } = await renderPage({ providers: () => [ANTHROPIC, OPENAI] });
    const provider = await screen.findByRole("button", { name: "AI provider Not chosen" });
    // Connect waits for a key, grey; Enter in the field asks for what is missing all the same.
    expect(connect()).toHaveAttribute("aria-disabled", "true");
    await userEvent.fill(keyField(), KEY);
    expect(connect()).not.toHaveAttribute("aria-disabled");
    await userEvent.click(connect());
    expect(provider).toHaveAccessibleDescription("Choose the provider");
    expect(document.activeElement).toBe(provider);
    await userEvent.click(provider);
    await userEvent.click(await screen.findByRole("radio", { name: "OpenAI" }));
    expect(screen.getByRole("button", { name: "AI provider OpenAI" })).toBeTruthy();
    await userEvent.clear(keyField());
    await userEvent.type(keyField(), "{Enter}");
    expect(await screen.findByText("Enter the key")).toBeTruthy();
    expect(document.activeElement).toBe(keyField());
    expect(checked).toEqual([]);
    await enter(KEY);
    expect(await screen.findByText("Key ending in a1b2")).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();
  });

  it("says when no provider takes an own key, with no field, and retries a list that did not come", async () => {
    await renderPage({ providers: () => [] });
    expect(
      await screen.findByText(/No AI provider takes an own key on this server yet/),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Key")).toBeNull();
    cleanup();
    let fail = true;
    await renderPage({
      providers: () => {
        if (fail) throw new ConnectError("down", Code.Unavailable);
        return [ANTHROPIC];
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Key")).toBeTruthy();
  });

  it("says a check that did not go through, and keeps the field", async () => {
    await renderPage({
      check: () => {
        throw new ConnectError("down", Code.Unavailable);
      },
    });
    await enter(KEY);
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    expect(keyField()).toHaveValue(KEY);
  });

  it("says when the next check opens once the account's checks are exhausted", async () => {
    // Noon three days on by the device's calendar: on its date, at whatever moment the page reads.
    const today = new Date();
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 12, 0);
    const time = dateTimeFormat("en", { timeStyle: "short" }).format(next);
    const date = dateTimeFormat("en", { day: "numeric", month: "long" }).format(next);
    const { checked } = await renderPage({
      check: () => {
        throw new ConnectError("refused", Code.ResourceExhausted, undefined, [
          {
            desc: RefusalSchema,
            value: create(RefusalSchema, {
              cause: Cause.KEY_CHECKS_EXHAUSTED,
              data: { case: "nextKeyCheck", value: timestampFromDate(next) },
            }),
          },
        ]);
      },
    });
    await enter(KEY);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `You've checked keys too many times. You can check again on ${date} at ${time}`,
    );
    expect(keyField()).toHaveValue(KEY);
    expect(checked).toHaveLength(1);
  });

  it("replaces the key only once the new one is accepted, and removes it, asked first", async () => {
    let answer: Answer = { check: OwnKeyCheck.ACCEPTED };
    const { holder } = await renderPage({ check: () => answer });
    await enter(KEY);
    await screen.findByText("Key ending in a1b2");
    await userEvent.click(screen.getByRole("button", { name: "Replace the key" }));
    expect(screen.getByText(/stays until the new one passes the check/)).toBeTruthy();
    answer = { check: OwnKeyCheck.INVALID };
    await enter(NEXT);
    await screen.findByText(/it isn't valid/);
    expect(holder.aiFields("p1")).toMatchObject({ ownKey: { key: KEY } });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Key ending in a1b2")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Replace the key" }));
    answer = { check: OwnKeyCheck.ACCEPTED };
    await enter(NEXT);
    expect(await screen.findByText("Key ending in c3d4")).toBeTruthy();
    expect(holder.aiFields("p1")).toMatchObject({ ownKey: { key: NEXT } });
    expect(screen.getByText(/go to the platform's AI and spend its tutor time/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove key" }));
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(await screen.findByText("The key is removed")).toBeTruthy();
    expect(holder.routeFields("p1")).toEqual({});
    expect(await screen.findByLabelText("Key")).toBeTruthy();
  });

  it("says what to do beside the key when its provider refused it or its limit ran out", async () => {
    const { holder } = await renderPage();
    await enter(KEY);
    await screen.findByText("Key ending in a1b2");
    const sent = holder.aiFields("p1");
    holder.noteOutcome("p1", { cause: Cause.KEY_REFUSED }, sent);
    expect(
      await screen.findByText(/The provider refused the key at the last request/),
    ).toBeTruthy();
    holder.noteOutcome("p1", { cause: Cause.LIMIT_REACHED }, sent);
    expect(await screen.findByText("The limit of your AI key is used up")).toBeTruthy();
    expect(
      screen.getByText(
        "Raise the limit or top up the balance at the provider, replace the key, or remove it to go to the platform's AI",
      ),
    ).toBeTruthy();
    holder.noteOutcome("p1", undefined, sent);
    await waitFor(() => expect(screen.queryByText(/Raise the limit/)).toBeNull());
  });

  it("says beside the key which limit ran out, when access comes back if api says, and what to do", async () => {
    const { holder } = await renderPage();
    await enter(KEY);
    await screen.findByText("Key ending in a1b2");
    const sent = holder.aiFields("p1");
    const limit = (cause: LimitCause, at?: Date) => ({
      cause: Cause.LIMIT_REACHED as const,
      ownKeyLimit: create(OwnKeyLimitSchema, {
        cause,
        ...(at === undefined ? {} : { accessReturns: timestampFromDate(at) }),
      }),
    });
    // The ceiling of the tier, back at 00:00 UTC on the first of a month three months on,
    // so that the line names its date whatever the day of the run.
    const now = new Date();
    const returns = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
    const date = dateTimeFormat("en", { day: "numeric", month: "long" }).format(returns);
    const time = dateTimeFormat("en", { timeStyle: "short" }).format(returns);
    holder.noteOutcome("p1", limit(LimitCause.TIER, returns), sent);
    expect(
      await screen.findByText(
        `Your AI key has reached the limit of its usage tier at the provider. Access comes back on ${date} at ${time}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText("Replace the key, or remove it to go to the platform's AI"),
    ).toBeTruthy();
    // A time already past — the refusal kept beside the key since — is no promise: none.
    holder.noteOutcome("p1", limit(LimitCause.TIER, new Date(Date.now() - 60_000)), sent);
    expect(
      await screen.findByText(
        "Your AI key has reached the limit of its usage tier at the provider",
      ),
    ).toBeTruthy();
    // The owner's own limit has no time: what to do about it alone.
    holder.noteOutcome("p1", limit(LimitCause.LIMIT), sent);
    expect(
      await screen.findByText("The spending limit set for your AI key is reached"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Raise the spending limit you set at the provider, replace the key, or remove it to go to the platform's AI",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Access comes back/)).toBeNull();
    holder.noteOutcome("p1", limit(LimitCause.BALANCE), sent);
    expect(await screen.findByText(/Top up the balance at the provider/)).toBeTruthy();
    holder.noteOutcome("p1", limit(LimitCause.PAYMENT), sent);
    expect(await screen.findByText(/Check the payment details at the provider/)).toBeTruthy();
    // A limit the build does not know is the limit at large.
    holder.noteOutcome("p1", limit(99 as LimitCause), sent);
    expect(await screen.findByText("The limit of your AI key is used up")).toBeTruthy();
    expect(
      screen.getByText(
        "Raise the limit or top up the balance at the provider, replace the key, or remove it to go to the platform's AI",
      ),
    ).toBeTruthy();
  });

  it("says when the device did not take the key to keep, connected and replaced alike", async () => {
    await renderPage({ full: true });
    await userEvent.click(await screen.findByRole("switch", { name: "Keep on this device" }));
    await enter(KEY);
    await screen.findByText("Key ending in a1b2");
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't be kept");
    expect(screen.getByText("The key is in this tab's memory alone")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Replace the key" }));
    await userEvent.click(screen.getByRole("switch", { name: "Keep on this device" }));
    await enter(NEXT);
    await screen.findByText("Key ending in c3d4");
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't be kept");
    // The mark shows where the key is: not on the device.
    expect(screen.getByRole("switch", { name: "Keep on this device" })).not.toBeChecked();
  });

  it("opens the owner profile from the page when no learner is chosen", async () => {
    const { onOpenOwner } = await renderPage({ closed: true });
    expect(screen.getByText(/Open your profile first/)).toBeTruthy();
    expect(screen.queryByLabelText("Key")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open my profile" }));
    expect(onOpenOwner).toHaveBeenCalledOnce();
    expect(await screen.findByLabelText("Key")).toBeTruthy();
  });

  it("has no key for an account with no owner profile of an adult", async () => {
    await renderPage({ profiles: [{ ...OWNER, ageCategory: "under_13" }] });
    expect(screen.getByText(/Only your own profile as an adult learner/)).toBeTruthy();
    expect(screen.queryByLabelText("Key")).toBeNull();
  });
});
