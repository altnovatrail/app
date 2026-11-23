// A profile's avatar: the picture of its code from the set of app, white on its
// gradient in a circle, or the set's own where the profile has none of the set. The picture says
// nothing the name beside it does not: it is hidden from assistive technology.
import type { CSSProperties } from "react";
import { Icon } from "../app/Icon.tsx";
import { avatarOf } from "./avatars.ts";

export interface AvatarProps {
  /** The profile's field `avatar`: empty, a code of the set, or one this build does not know. */
  readonly code: string | undefined;
  /**
   * Its diameter: the profile's on "Who is learning?" 140, on the owner's profile 112, a choice 48,
   * in the profile's pill 36 and in its menu 30.
   */
  readonly size: "large" | "profile" | "choice" | "pill" | "menu";
}

export function Avatar({ code, size }: AvatarProps) {
  const { code: shown, icon, from, to } = avatarOf(code);
  const style = { "--nt-avatar-from": from, "--nt-avatar-to": to } as CSSProperties;
  return (
    <span className={`nt-avatar nt-avatar-${size}`} data-avatar={shown} style={style}>
      <Icon value={icon} />
    </span>
  );
}
