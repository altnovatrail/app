// The holder of the owner's own key (R08 and R47 in docs/decisions.md; section 3.6 of
// docs/architecture.md; section 15 of the text of the contracts), with no DOM: the one module that
// gives the key out, and only for the owner profile of the category `adult` while it is the
// learner chosen. The key lives in the tab's memory while that profile is open, and in its
// database only while the adult keeps it on this device; it is never in the holder's snapshot,
// which the screens read. A request that calls AI takes from it the key — and so no clock offset —,
// or on platform AI the offset; a request that may give an engine's choice, the provider alone. A
// new key comes in only once `CheckOwnKey` has accepted it, in place of the former one; the other
// tabs hear of each change and read the database again. A refusal of the key or its limit reached
// stays beside the key for the section for adults, and nothing moves to platform AI behind the
// owner's back.

import { OwnKeySchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { aiFields } from "../api/keys.ts";
import type { ReadOutcome } from "../api/outcome.ts";
import type { KeyStore } from "../storage/ownkey.ts";
import type { KeptKey, Saved } from "../storage/profile.ts";

/** The key held, as the screens see it: its provider and last four characters, never the key. */
export interface HeldKey {
  /** The provider by its code in the admission table. */
  readonly provider: string;
  /** The provider's name, as `ListOwnKeyProviders` gave it. */
  readonly name: string;
  readonly last4: string;
  /** Whether it is kept on this device, in the owner profile's database. */
  readonly kept: boolean;
  /** It was to be kept on this device, and the device did not take it: it is in memory alone. */
  readonly unsaved?: true;
}

/** What a call of AI on the key came to that the owner is to act on: the key refused, or its limit. */
export type KeyRefusal = ReadOutcome & {
  readonly cause: Cause.KEY_REFUSED | Cause.LIMIT_REACHED;
};

export type HolderState =
  /** No owner profile open: no key in memory. */
  | { readonly status: "closed" }
  /** The owner profile opened: its key kept on this device is being read. */
  | { readonly status: "opening"; readonly profileId: string }
  | {
      readonly status: "open";
      readonly profileId: string;
      readonly key?: HeldKey;
      readonly refusal?: KeyRefusal;
    };

/** A key to connect: its provider by code and name, and the key as the provider gave it. */
export interface NewKey {
  readonly provider: string;
  readonly name: string;
  readonly key: string;
}

const CLOSED: HolderState = { status: "closed" };

/** Whether an outcome is one the owner acts on beside the key. */
export function refusesKey(outcome: ReadOutcome | undefined): outcome is KeyRefusal {
  return outcome?.cause === Cause.KEY_REFUSED || outcome?.cause === Cause.LIMIT_REACHED;
}

export class KeyHolder {
  private state: HolderState = CLOSED;
  /** The key itself, beside the state and never in it. */
  private secret: string | undefined;
  /** Each opening and closing is a run: a read of one that another replaced is dropped. */
  private run = 0;
  /** Each change of the key in memory: a read of the device that one outran is dropped. */
  private changes = 0;
  /** The writes to the device, one after another, so that the last one asked is the one there. */
  private writing: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private readonly store: KeyStore;
  private readonly tell: (profileId: string) => void;

  /** `tell` tells the other tabs that the key of the profile changed. */
  constructor(store: KeyStore, tell: (profileId: string) => void = () => {}) {
    this.store = store;
    this.tell = tell;
  }

  readonly snapshot = (): HolderState => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(state: HolderState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }

  private openFor(profileId: string): boolean {
    return this.state.status === "open" && this.state.profileId === profileId;
  }

  /** The owner profile is in memory with this key, or none, and no refusal beside it. */
  private hold(profileId: string, kept: KeptKey | undefined, keep: boolean): void {
    this.changes += 1;
    this.secret = kept?.key;
    this.set(
      kept === undefined
        ? { status: "open", profileId }
        : {
            status: "open",
            profileId,
            key: { provider: kept.provider, name: kept.name, last4: kept.last4, kept: keep },
          },
    );
  }

  /** The owner profile is the learner chosen: the key it keeps on this device comes into memory. */
  async open(profileId: string): Promise<void> {
    if (this.state.status !== "closed" && this.state.profileId === profileId) return;
    this.secret = undefined;
    this.set({ status: "opening", profileId });
    await this.readFor(profileId);
  }

  /** Reads the key kept on this device into memory, unless a closing or a change outran it. */
  private async readFor(profileId: string): Promise<void> {
    this.run += 1;
    const run = this.run;
    const changes = this.changes;
    const kept = await this.store.read(profileId).catch(() => undefined);
    if (run === this.run && changes === this.changes) this.hold(profileId, kept, true);
  }

  /** The owner profile closed — another learner, the sign-out, a reload —: the key leaves memory. */
  close(): void {
    this.run += 1;
    this.changes += 1;
    this.secret = undefined;
    if (this.state.status !== "closed") this.set(CLOSED);
  }

  /** The key for a request of this profile; none for any other, or with no owner profile open. */
  private keyFor(profileId: string) {
    if (!this.openFor(profileId) || this.state.status !== "open") return undefined;
    const { key } = this.state;
    if (key === undefined || this.secret === undefined) return undefined;
    return create(OwnKeySchema, { provider: key.provider, key: this.secret });
  }

  /** The fields of a request of the profile that calls AI: the key, or the clock's offset. */
  aiFields(profileId: string, now?: Date): ReturnType<typeof aiFields> {
    return aiFields(this.keyFor(profileId), now);
  }

  /**
   * The field of a request of the profile that may give an engine's choice and sends no key: the
   * provider alone, or nothing on platform AI. Never beside a work or a key (contract, section 15).
   */
  routeFields(profileId: string): { readonly ownKeyProvider: string } | Record<string, never> {
    const key = this.keyFor(profileId);
    return key === undefined ? {} : { ownKeyProvider: key.provider };
  }

  /**
   * A key `CheckOwnKey` accepted, in place of the former one: in memory, and on this device only
   * when the adult keeps it there — else the former one kept goes. "unsaved" when it was to be
   * kept and was not: it is in memory alone then.
   */
  async connect(profileId: string, key: NewKey, keep: boolean): Promise<Saved> {
    if (!this.openFor(profileId)) return "unsaved";
    const kept: KeptKey = { ...key, last4: key.key.slice(-4) };
    this.hold(profileId, kept, false);
    const saved = await this.write(profileId, kept, keep);
    this.tell(profileId);
    return saved;
  }

  /** The key kept on this device, or not: memory keeps it either way while the profile is open. */
  async setKeep(profileId: string, keep: boolean): Promise<Saved> {
    if (!this.openFor(profileId) || this.state.status !== "open") return "unsaved";
    const { key } = this.state;
    if (key === undefined || this.secret === undefined) return "unsaved";
    const { provider, name, last4 } = key;
    const saved = await this.write(profileId, { provider, name, key: this.secret, last4 }, keep);
    this.tell(profileId);
    return saved;
  }

  /** Writes the key to the device, or erases it there, after the writes before it. */
  private write(profileId: string, kept: KeptKey, keep: boolean): Promise<Saved> {
    const written = this.writing.then(async (): Promise<Saved> => {
      let saved: Saved = "saved";
      if (keep) saved = await this.store.keep(profileId, kept);
      // A key not kept, or not written, leaves no former one on the device.
      if (!keep || saved === "unsaved") await this.store.drop(profileId).catch(() => {});
      this.wrote(profileId, kept.key, keep, saved);
      return saved;
    });
    this.writing = written;
    return written;
  }

  /** The state says where the key is, if it is still the key written. */
  private wrote(profileId: string, key: string, keep: boolean, saved: Saved): void {
    const now = this.state;
    if (!this.openFor(profileId) || now.status !== "open" || now.key === undefined) return;
    if (this.secret !== key) return;
    const { unsaved: _, ...rest } = now.key;
    const unsaved = keep && saved === "unsaved";
    this.set({ ...now, key: { ...rest, kept: keep && !unsaved, ...(unsaved ? { unsaved } : {}) } });
  }

  /**
   * "Remove key", on the page Own AI key or This device: from memory and from the device; with no
   * owner profile open, from the device alone. Its requests go on platform AI then.
   */
  async remove(profileId: string): Promise<void> {
    if (this.openFor(profileId)) this.hold(profileId, undefined, false);
    const dropped = this.writing.then(() => this.store.drop(profileId).catch(() => {}));
    this.writing = dropped;
    await dropped;
    this.tell(profileId);
  }

  /**
   * Another tab changed the key of the profile: the one kept on this device, if any, takes the
   * place of the one in memory, in one step, once it is read; with none kept, the one in memory
   * goes. A change made here meanwhile wins, and a profile still opening reads the device again.
   */
  async heard(profileId: string): Promise<void> {
    if (this.state.status === "closed" || this.state.profileId !== profileId) return;
    await this.readFor(profileId);
  }

  /**
   * What a call of AI on the key came to, with the fields the call was sent with: a refusal of the
   * key or its limit stays beside it for the section for adults, and a call that gave what it was
   * for takes it away. A call sent with another key, or with none, says nothing of this one.
   */
  noteOutcome(
    profileId: string,
    outcome: ReadOutcome | undefined,
    sent: ReturnType<typeof aiFields>,
  ): void {
    if (this.keyFor(profileId) === undefined || this.state.status !== "open") return;
    if (!("ownKey" in sent) || sent.ownKey.key !== this.secret) return;
    if (refusesKey(outcome)) this.set({ ...this.state, refusal: outcome });
    else if (outcome === undefined && this.state.refusal !== undefined) {
      const { refusal: _, ...rest } = this.state;
      this.set(rest);
    }
  }
}

/** A holder that never opens, so never holds a key. */
class NoKeyHolder extends KeyHolder {
  override async open(): Promise<void> {}
}

/** A holder with no store and nothing open: outside the account, as in a screen's own test. */
export function noKeyHolder(): KeyHolder {
  return new NoKeyHolder({
    read: async () => undefined,
    keep: async () => "unsaved",
    drop: async () => {},
  });
}
