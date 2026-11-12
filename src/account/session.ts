// The sign-in and the account of this tab (sections 3.2 and 3.10 of docs/architecture.md; section
// 15 of the text of the contracts; R04 with its amendments and R19 in docs/decisions.md), with no
// DOM: who is signed in, the account `GetAccount` gives at the start and after each sign-in, and
// what the device erases on each. An account in the registry other than the one api names goes
// before anything of the app opens; a profile the list does not hold goes; a failure of the network
// erases nothing. A user with no account gets the invite code, an account with no owner's profile
// gets that profile, and the learner chosen lives in memory alone. The sign-out signs out of the
// sign-in service first, then erases everything of the account.
import type { Account, Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { LegalTextRef } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure, refusedWith } from "../api/failure.ts";
import type { PackageChecks } from "../packages/checks.ts";
import type { SignInResult, SignInService } from "../signin/service.ts";
import type { Device } from "../storage/device.ts";
import { accountSeen, eraseAccount, eraseDevice, profilesListed } from "../storage/erase.ts";
import { openProfileDatabase } from "../storage/profile.ts";
import { eraseDatabases, readRegistry, type SignIn, setSignIn } from "../storage/registry.ts";
import { profileDatabase } from "../storage/schema.ts";
import { withSettings } from "./settings.ts";

export type SessionState =
  /** The sign-in service has not read its session yet. */
  | { readonly step: "starting" }
  /** Nobody signed in; `result` is what came of the last window, if anything is to be said. */
  | { readonly step: "signed-out"; readonly result?: SignInResult }
  /** `GetAccount` asked. */
  | { readonly step: "loading" }
  /** api did not answer: nothing is erased, and a retry asks again. */
  | { readonly step: "offline" }
  /** The registry could not be read or written: nothing of the account opens. */
  | { readonly step: "unreadable" }
  /**
   * What another account left on the device could not be erased yet — another tab holds it —, so
   * nothing of this account opens; a retry erases it again.
   */
  | { readonly step: "held" }
  /** api answered with a failure no step of the session is for. */
  | { readonly step: "failed"; readonly failure: Failure }
  /** The user has no account: the invite code, and the statement of being 18 or older. */
  | { readonly step: "invite" }
  /** The account has no owner's profile yet. */
  | { readonly step: "owner-profile"; readonly account: Account }
  /** The choice of the learner; `first` when the registry did not name the account before. */
  | {
      readonly step: "choose";
      readonly account: Account;
      readonly owner: Profile;
      readonly first: boolean;
    }
  /** A learner chosen, in memory alone (section 3.2). */
  | { readonly step: "learning"; readonly account: Account; readonly learner: Profile };

/** What came of a form that asks api: done, the form's own refusal, or a failure to show. */
export type FormResult<Own extends string> = "done" | Own | Failure;

/** The pseudonym api takes: trimmed at its ends, from 1 to 30 Unicode code points (R98 in spec). */
export function pseudonymOf(text: string): string | undefined {
  const trimmed = text.trim();
  const length = [...trimmed].length;
  return length >= 1 && length <= 30 ? trimmed : undefined;
}

/** The unfinished work of a profile on this device, as the sign-out names it. */
export interface Unfinished {
  readonly profileId: string;
  readonly pseudonym: string;
  readonly count: number;
}

/**
 * The attempts each profile of the account keeps unfinished on this device: the work the sign-out
 * would take (section 3.2). A profile with none, or with no database here, is not named.
 */
export async function unfinishedWork(
  device: Device,
  profiles: readonly Profile[],
): Promise<Unfinished[]> {
  const registry = await readRegistry(device);
  const found: Unfinished[] = [];
  for (const profile of profiles) {
    const name = profileDatabase(profile.profileId);
    const entry = registry?.databases.get(name);
    if (entry === undefined || entry.erase) continue;
    const count = (await (await openProfileDatabase(device, name))?.unfinished()) ?? 0;
    if (count > 0)
      found.push({ profileId: profile.profileId, pseudonym: profile.pseudonym, count });
  }
  return found;
}

export interface SessionOptions {
  readonly api: Api;
  readonly device: Device;
  readonly service: SignInService;
  /** The project of the sign-in service in /deployment.json, which the registry keeps. */
  readonly project: SignIn;
  /** The checks of packages: they start once an account is there, and stop when it goes. */
  readonly checks?: PackageChecks;
}

export class Session {
  private readonly options: SessionOptions;
  private state: SessionState = { step: "starting" };
  private readonly listeners = new Set<() => void>();
  /** The user the session went by last; a new one starts again. */
  private user: string | null | undefined;
  /** Each load is a run: the answer of one that another has replaced is dropped. */
  private run = 0;
  private stopService: (() => void) | undefined;
  /** A sign-out under way: no user it signs out starts anything until its erasure is done. */
  private leaving = false;
  /**
   * The account whose first sign-in on this device this is: the registry did not name it. It stays
   * so through the making of its owner's profile, until a learner is chosen.
   */
  private fresh: string | undefined;

  constructor(options: SessionOptions) {
    this.options = options;
  }

  readonly snapshot = (): SessionState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Follows the sign-in service; once for a session, however often it is called. */
  start(): void {
    if (this.stopService !== undefined) return;
    this.stopService = this.options.service.subscribe(() => this.userChanged());
    this.userChanged();
  }

  stop(): void {
    // A load still under way is this session's no more, and a start again goes by the user then.
    this.run += 1;
    this.user = undefined;
    this.stopService?.();
    this.stopService = undefined;
    this.options.checks?.stop();
  }

  private set(state: SessionState): void {
    const opened = state.step === "choose" || state.step === "learning";
    const was = this.state.step === "choose" || this.state.step === "learning";
    this.state = state;
    if (opened && !was) {
      this.options.checks?.start();
      void this.options.checks?.check();
    } else if (!opened && was) {
      this.options.checks?.stop();
    }
    for (const listener of [...this.listeners]) listener();
  }

  private userChanged(): void {
    if (this.leaving) return;
    const user = this.options.service.user();
    if (user === this.user) return;
    this.user = user;
    if (user === undefined) {
      this.set({ step: "starting" });
    } else if (user === null) {
      this.run += 1;
      this.set({ step: "signed-out" });
    } else {
      void this.load();
    }
  }

  /** Asks `GetAccount`, and erases on the device by its answer. */
  async load(): Promise<void> {
    this.run += 1;
    const run = this.run;
    this.set({ step: "loading" });
    try {
      await setSignIn(this.options.device, this.options.project);
    } catch {
      if (run === this.run) this.set({ step: "unreadable" });
      return;
    }
    let account: Account | undefined;
    try {
      account = (await this.options.api.account.getAccount({})).account;
    } catch (reason) {
      if (run === this.run) this.failed(parseFailure(reason));
      return;
    }
    await this.seen(run, account);
  }

  /**
   * An account api named: the registry names it — another one it named before goes first — and
   * the profiles it no longer has go; then the owner's profile, or its making.
   */
  private async seen(run: number, account: Account | undefined): Promise<void> {
    if (run !== this.run) return;
    if (account === undefined) {
      this.set({ step: "failed", failure: { kind: "invalid" } });
      return;
    }
    const { device } = this.options;
    try {
      if ((await readRegistry(device))?.account !== account.accountId) {
        this.fresh = account.accountId;
      }
      await accountSeen(device, account.accountId);
      // Whatever is still to be erased goes before anything opens, as at the start (section 3.2):
      // a database another tab holds keeps this account shut until it is gone.
      const left = [...((await readRegistry(device))?.databases ?? [])]
        .filter(([, entry]) => entry.erase)
        .map(([name]) => name);
      if (!(await eraseDatabases(device, left))) {
        if (run === this.run) this.set({ step: "held" });
        return;
      }
      // A profile deleted elsewhere that cannot go yet is not shown, and the next start erases it.
      await profilesListed(
        device,
        account.accountId,
        account.profiles.map((profile) => profile.profileId),
      );
    } catch {
      if (run === this.run) this.set({ step: "unreadable" });
      return;
    }
    if (run !== this.run) return;
    const owner = account.profiles.find((profile) => profile.owner);
    this.set(
      owner === undefined
        ? { step: "owner-profile", account }
        : { step: "choose", account, owner, first: this.fresh === account.accountId },
    );
  }

  /** What a failure of `GetAccount` comes to. */
  private failed(failure: Failure): void {
    switch (failure.kind) {
      case "no-access":
        // What was left of an account the registry named, the client erased already (R04).
        this.set({ step: "invite" });
        return;
      case "offline":
        this.set({ step: "offline" });
        return;
      case "sign-in":
      case "account-gone":
        this.set({ step: "signed-out" });
        return;
      default:
        this.set({ step: "failed", failure });
    }
  }

  /**
   * A failure of a change of a profile in the section for adults: one that is the session's own
   * moves it, and a profile api no longer has — deleted on another device — asks for the account
   * again, which erases it here (R04). The page shows the rest.
   */
  profileFailed(failure: Failure): void {
    if (refusedWith(failure, Cause.NO_PROFILE)) void this.load();
    else this.formFailure(failure);
  }

  /** A failure of a form: one that is the session's own moves it, the rest the form shows. */
  private formFailure(failure: Failure): Failure {
    if (failure.kind === "sign-in" || failure.kind === "account-gone") this.failed(failure);
    return failure;
  }

  /**
   * The sign-in window, on a press. Signed in as the user already there — a sign-in that could not
   * be renewed — asks for the account again, as a new user would.
   */
  async signIn(): Promise<SignInResult> {
    const before = this.options.service.user();
    const result = await this.options.service.signIn();
    if (result.kind === "done") {
      // Another user is the service's to tell, and that starts the load; the same one is not.
      if (this.state.step === "signed-out" && this.options.service.user() === before) {
        void this.load();
      }
    } else if (this.state.step === "signed-out") {
      this.set({ step: "signed-out", ...(result.kind === "closed" ? {} : { result }) });
    }
    return result;
  }

  /**
   * `CreateAccount` with the invite code — the form sends it trimmed at its ends, and api ignores
   * dashes and spaces within it —, the statement of being 18 or older, and the versions of the
   * privacy policy and the terms of use the owner accepted, as `GetLegalTexts` gave them (R131 in
   * spec; R27): none while none is in force. A version no longer current is the form's to show anew.
   */
  async createAccount(
    inviteCode: string,
    acceptedTexts: readonly Pick<LegalTextRef, "id" | "version">[] = [],
  ): Promise<FormResult<"code-not-accepted" | "text-not-current">> {
    const run = this.run;
    try {
      const answer = await this.options.api.account.createAccount({
        inviteCode,
        adultStated: true,
        acceptedTexts: [...acceptedTexts],
      });
      await this.seen(run, answer.account);
      return "done";
    } catch (reason) {
      const failure = parseFailure(reason);
      if (refusedWith(failure, Cause.CODE_NOT_ACCEPTED)) return "code-not-accepted";
      if (refusedWith(failure, Cause.TEXT_NOT_CURRENT)) return "text-not-current";
      if (refusedWith(failure, Cause.ALREADY_EXISTS)) {
        await this.load();
        return "done";
      }
      return this.formFailure(failure);
    }
  }

  /**
   * `CreateOwnerProfile`, of the category `adult`, with the owner's country and pseudonym, and the
   * language of the screen as the language of the learner's screens, as the contract has a new
   * profile take the language of the section for adults (R10).
   */
  async createOwnerProfile(
    pseudonym: string,
    country: string,
    language: string,
  ): Promise<FormResult<"country-not-accepted">> {
    try {
      await this.options.api.account.createOwnerProfile({
        country,
        settings: { pseudonym, interfaceLanguage: language },
      });
    } catch (reason) {
      const failure = parseFailure(reason);
      if (refusedWith(failure, Cause.COUNTRY_NOT_ACCEPTED)) return "country-not-accepted";
      if (!refusedWith(failure, Cause.ALREADY_EXISTS)) return this.formFailure(failure);
    }
    await this.load();
    return "done";
  }

  /** The learner chosen: the owner's profile, with no PIN while the account has no child. */
  choose(): void {
    if (this.state.step !== "choose") return;
    this.fresh = undefined;
    this.set({ step: "learning", account: this.state.account, learner: this.state.owner });
  }

  /**
   * A profile api changed — in this tab, or in another that told of it —: the account's profile of
   * its ID takes its settings, the learner chosen too (R29). An account that holds no such profile
   * is another's, and stays as it is.
   */
  profileChanged(changed: Profile): void {
    const state = this.state;
    if (state.step !== "choose" && state.step !== "learning") return;
    const before = state.account.profiles.find(
      (profile) => profile.profileId === changed.profileId,
    );
    if (before === undefined) return;
    const after = withSettings(before, changed);
    const swap = (profile: Profile) => (profile.profileId === changed.profileId ? after : profile);
    const account = { ...state.account, profiles: state.account.profiles.map(swap) };
    this.set(
      state.step === "choose"
        ? { ...state, account, owner: swap(state.owner) }
        : { ...state, account, learner: swap(state.learner) },
    );
  }

  /** Back to the choice of the learner: "Switch learner". */
  switchLearner(): void {
    if (this.state.step !== "learning") return;
    const { account, learner } = this.state;
    this.set({ step: "choose", account, owner: learner, first: false });
  }

  /**
   * The sign-out: the sign-in service's first, then everything of the account on this device
   * (R04), and with `everything` — "Erase everything on this device" — the device's settings and
   * the heartbeats of @firebase/app too. `"erased"` when all of it is gone, `"left"` when some
   * is, which the next start erases of the account, and `"failed"` when the service did not sign
   * out: then nothing is erased, since the same user would open the account again over its data
   * gone.
   */
  async signOut(everything = false): Promise<"erased" | "left" | "failed"> {
    try {
      await this.options.service.signOut();
    } catch {
      return "failed";
    }
    this.run += 1;
    this.leaving = true;
    this.set({ step: "loading" });
    const account = await eraseAccount(this.options.device).catch(() => false);
    const device = everything ? await eraseDevice(this.options.device).catch(() => false) : true;
    const erased = account && device;
    this.leaving = false;
    // Whoever the service names now — nobody, once it has signed out — the session starts from.
    this.user = undefined;
    this.userChanged();
    return erased ? "erased" : "left";
  }
}
