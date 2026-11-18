// The set of avatars of app (R61; R98 and R148 spec): a profile keeps the code of one, and no
// picture is uploaded. Each is a picture of Material Symbols Rounded, in outline, white on a
// gradient of the mockup's. A profile with no avatar, or with a code this build does not know — one
// a newer build gave —, shows the set's own, the first. No DOM.
import type { IconValue } from "../app/icons.ts";

export interface Avatar {
  /** The code api keeps in the profile's field `avatar`: ASCII, up to 64 characters. */
  readonly code: string;
  /** Its picture, a value of the app's icons. */
  readonly icon: IconValue;
  /** Its gradient, from the top left to the bottom right. */
  readonly from: string;
  readonly to: string;
}

/** The set, in the order the choice shows it: the first is the set's own. */
export const AVATARS = [
  { code: "peak", icon: "avatar-peak", from: "#8e8e93", to: "#3a3a3c" },
  { code: "rocket", icon: "avatar-rocket", from: "#5e5ce6", to: "#0a84ff" },
  { code: "leaf", icon: "avatar-leaf", from: "#30d158", to: "#0fa3a3" },
  { code: "star", icon: "avatar-star", from: "#ffb340", to: "#ff9f0a" },
  { code: "moon", icon: "avatar-moon", from: "#5e5ce6", to: "#1e1b4b" },
  { code: "wave", icon: "avatar-wave", from: "#64d2ff", to: "#0071e3" },
  { code: "sun", icon: "avatar-sun", from: "#ffd60a", to: "#ff9f0a" },
  { code: "bolt", icon: "avatar-bolt", from: "#ff375f", to: "#af52de" },
] as const satisfies readonly Avatar[];

/** A code of the set. */
export type AvatarCode = (typeof AVATARS)[number]["code"];

/** The set's own avatar, for a profile that has none of the set. */
export const OWN_AVATAR: Avatar = AVATARS[0];

/** The avatar a profile shows by its field: the one of its code, or the set's own. */
export function avatarOf(code: string | undefined): Avatar {
  return AVATARS.find((avatar) => avatar.code === code) ?? OWN_AVATAR;
}
