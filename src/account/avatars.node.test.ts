// The set of avatars (R61 in docs/decisions.md; section 3.10 of docs/architecture.md): each code
// once, of ASCII up to 64 characters as api keeps it, each with its own picture, and the set's own
// for a profile with no avatar or a code this build does not know.
import { describe, expect, it } from "vitest";
import { AVATARS, avatarOf, OWN_AVATAR } from "./avatars.ts";

describe("the set of avatars", () => {
  it("has each code and picture once, as api keeps a code", () => {
    const codes = AVATARS.map(({ code }) => code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(AVATARS.map(({ icon }) => icon)).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[\x21-\x7e]{1,64}$/);
  });

  it("gives the avatar of a code, and the set's own for none or an unknown one", () => {
    expect(avatarOf("moon").icon).toBe("avatar-moon");
    expect(OWN_AVATAR.code).toBe("peak");
    for (const code of [undefined, "", "comet"]) expect(avatarOf(code)).toBe(OWN_AVATAR);
  });
});
