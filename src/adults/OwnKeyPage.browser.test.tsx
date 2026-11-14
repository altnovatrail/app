// The page Own AI key in the browser (R08 and R47 in docs/decisions.md; section 3.6 of
// docs/architecture.md), with api on connect-es's router and the storage on the engine's own
// IndexedDB: the words before the field, the providers api gives and none, the five answers of the
// check and one this build does not know, a key not accepted that leaves the former one, the key
// shown by its last four alone, the mark that keeps it on the device and the key in none of the
// browser's storages without it, its replacement and removal, a refusal beside it, and the owner
// profile opened from the page.
import {
  AccountService,
  type CheckOwnKeyRequest,
  type CheckOwnKeyResponseSchema,
  OwnKeyCheck,
  type Profile,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { KeyHolder } from "../ownkey/holder.ts";
import { KeyHolderProvider } from "../ownkey/OwnKeyContext.tsx";
import { browserDevice } from "../storage/browser.ts";
import { indexedDbBackend } from "../storage/idb.ts";
import { deviceKeyStore, type KeyStore, keptKey } from "../storage/ownkey.ts";
import { setAccount } from "../storage/registry.ts";
import { inLanguage } from "../test/language.tsx";
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
  readonly providers?: () => (typeof ANTHROPIC)[];
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
            listOwnKeyProviders(request) {
              listed.push(request.profileId);
              return { providers: setup.providers?.() ?? [ANTHROPIC] };
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
  it("says what happens to the key before its field, and checks it with no learner's content", async () => {
    const { checked, listed, holder } = await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Own AI key" })).toBeTruthy();
    expect(screen.getByText(/lives there only while the request runs/)).toBeTruthy();
    expect(screen.getByText(/links each such request to your account/)).toBeTruthy();
    expect(screen.getByText(/A PIN doesn't protect the key/)).toBeTruthy();
    expect(screen.getByText(/separate OpenAI project with a hard spending limit/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    // The one provider is chosen already; the field hides what is typed and offers nothing.
    expect(await screen.findByRole("combobox", { name: "AI provider" })).toHaveValue("anthropic");
    expect(keyField()).toHaveAttribute("type", "password");
    expect(keyField()).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("checkbox", { name: "Keep on this device" })).not.toBeChecked();
    await enter(`  ${KEY}  `);
    expect(await screen.findByText("Connected: a key of Anthropic ending in a1b2")).toBeTruthy();
    expect(listed).toEqual(["p1"]);
    expect(checked).toHaveLength(1);
    expect(checked[0]?.profileId).toBe("p1");
    expect(checked[0]?.ownKey).toMatchObject({ provider: "anthropic", key: KEY });
    expect(holder.routeFields("p1")).toEqual({ ownKeyProvider: "anthropic" });
    // Shown by its last four alone.
    expect(document.body.textContent).not.toContain(KEY);
    expect(screen.getByText("The key is in this tab's memory alone")).toBeTruthy();
  });

  it("keeps the key in none of the browser's storages without the mark, and on the device with it", async () => {
    const { device } = await renderPage();
    await enter(KEY);
    await screen.findByText("Connected: a key of Anthropic ending in a1b2");
    expect(await stored(KEY)).toBe(false);
    await userEvent.click(screen.getByRole("checkbox", { name: "Keep on this device" }));
    await screen.findByText("The key is kept on this device");
    expect(await keptKey(device, "p1")).toMatchObject({ key: KEY, last4: "a1b2" });
    expect(await stored(KEY)).toBe(true);
    // The mark taken off erases it there; memory keeps it.
    await userEvent.click(screen.getByRole("checkbox", { name: "Keep on this device" }));
    await screen.findByText("The key is in this tab's memory alone");
    expect(await stored(KEY)).toBe(false);
  });

  it("keeps the key on the device when the mark is set before Connect", async () => {
    const { device } = await renderPage();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Keep on this device" }));
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
    const provider = await screen.findByRole("combobox", { name: "AI provider" });
    expect(provider).toHaveValue("");
    await userEvent.click(connect());
    expect(provider).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(provider);
    await userEvent.selectOptions(provider, "openai");
    await userEvent.click(connect());
    expect(await screen.findByText("Enter the key")).toBeTruthy();
    expect(document.activeElement).toBe(keyField());
    expect(checked).toEqual([]);
    await enter(KEY);
    expect(await screen.findByText("Connected: a key of OpenAI ending in a1b2")).toBeTruthy();
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

  it("replaces the key only once the new one is accepted, and removes it, asked first", async () => {
    let answer: Answer = { check: OwnKeyCheck.ACCEPTED };
    const { holder } = await renderPage({ check: () => answer });
    await enter(KEY);
    await screen.findByText("Connected: a key of Anthropic ending in a1b2");
    await userEvent.click(screen.getByRole("button", { name: "Replace the key" }));
    expect(screen.getByText(/stays until the new one passes the check/)).toBeTruthy();
    answer = { check: OwnKeyCheck.INVALID };
    await enter(NEXT);
    await screen.findByText(/it isn't valid/);
    expect(holder.aiFields("p1")).toMatchObject({ ownKey: { key: KEY } });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Connected: a key of Anthropic ending in a1b2")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Replace the key" }));
    answer = { check: OwnKeyCheck.ACCEPTED };
    await enter(NEXT);
    expect(await screen.findByText("Connected: a key of Anthropic ending in c3d4")).toBeTruthy();
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
    await screen.findByText("Connected: a key of Anthropic ending in a1b2");
    const sent = holder.aiFields("p1");
    holder.noteOutcome("p1", { cause: Cause.KEY_REFUSED }, sent);
    expect(
      await screen.findByText(/The provider refused the key at the last request/),
    ).toBeTruthy();
    holder.noteOutcome("p1", { cause: Cause.LIMIT_REACHED }, sent);
    expect(await screen.findByText(/Raise the limit or top up the balance there/)).toBeTruthy();
    holder.noteOutcome("p1", undefined, sent);
    await waitFor(() => expect(screen.queryByText(/Raise the limit/)).toBeNull());
  });

  it("says when the device did not take the key to keep, connected and replaced alike", async () => {
    await renderPage({ full: true });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Keep on this device" }));
    await enter(KEY);
    await screen.findByText("Connected: a key of Anthropic ending in a1b2");
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't be kept");
    expect(screen.getByText("The key is in this tab's memory alone")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Replace the key" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Keep on this device" }));
    await enter(NEXT);
    await screen.findByText("Connected: a key of Anthropic ending in c3d4");
    expect((await screen.findByRole("alert")).textContent).toContain("couldn't be kept");
    // The mark shows where the key is: not on the device.
    expect(screen.getByRole("checkbox", { name: "Keep on this device" })).not.toBeChecked();
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
