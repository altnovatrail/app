// The own key's holder for the screens (R08 and R47 in docs/decisions.md; section 3.6 of
// docs/architecture.md): one for the tab, made by the account's gate, which opens it while the
// owner profile of the category `adult` is the learner chosen and closes it otherwise. The tabs
// tell each other of a key changed on the channel `novatrail-own-key`. Outside the gate — a
// screen's own test — the holder holds nothing, and every request goes on platform AI.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { Device } from "../storage/device.ts";
import { deviceKeyStore } from "../storage/ownkey.ts";
import { type HolderState, KeyHolder, noKeyHolder } from "./holder.ts";

/** The channel on which a tab tells the others that a profile's own key changed. */
export const OWN_KEY_CHANNEL = "novatrail-own-key";

/** What a tab tells the others: the profile whose key changed. */
export interface KeyMessage {
  readonly profileId: string;
}

/** The profile a message of another tab names; none for a message that is not one. */
export function keyMessageOf(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("profileId" in data)) return undefined;
  const { profileId } = data;
  return typeof profileId === "string" && profileId !== "" ? profileId : undefined;
}

/** Whether a profile may have an own key: the owner's, of the category `adult` (R122 in spec). */
export function keyed(profile: Profile): boolean {
  return profile.owner && profile.ageCategory === "adult";
}

const NO_KEY = noKeyHolder();

const HolderContext = createContext<KeyHolder>(NO_KEY);

/** The holder of the tab's own key; one that holds nothing outside the account's gate. */
export function useKeyHolder(): KeyHolder {
  return useContext(HolderContext);
}

/** The holder's state, as the screens see it: never the key itself. */
export function useHeldKey(): HolderState {
  const holder = useKeyHolder();
  return useSyncExternalStore(holder.subscribe, holder.snapshot);
}

/** The holder of this tab, with its channel to the other tabs, for the device. */
export function useTabHolder(device: Device): KeyHolder {
  // The channel opens with the effect, not with the holder: a channel closed is never posted to.
  const { holder, link } = useMemo(() => {
    const link: { channel?: BroadcastChannel } = {};
    const holder = new KeyHolder(deviceKeyStore(device), (profileId) =>
      link.channel?.postMessage({ profileId } satisfies KeyMessage),
    );
    return { holder, link };
  }, [device]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const opened = new BroadcastChannel(OWN_KEY_CHANNEL);
    opened.onmessage = (event: MessageEvent) => {
      const profileId = keyMessageOf(event.data);
      if (profileId !== undefined) void holder.heard(profileId);
    };
    link.channel = opened;
    return () => {
      delete link.channel;
      opened.close();
    };
  }, [holder, link]);
  // A holder the tab no longer uses — another device — leaves nothing in memory.
  useEffect(() => () => holder.close(), [holder]);
  return holder;
}

export function KeyHolderProvider({
  holder,
  children,
}: {
  readonly holder: KeyHolder;
  readonly children: ReactNode;
}) {
  return <HolderContext.Provider value={holder}>{children}</HolderContext.Provider>;
}
