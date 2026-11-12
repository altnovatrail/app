// What an adult sets of a profile, with no DOM (R29 in docs/decisions.md; section 15 of the text of
// the contracts): the form as a profile gives it, only what changed for UpdateProfile — never a
// value the build does not know written back —, a profile with another's settings, and the message
// the tabs tell each other by.
import {
  Mode,
  ProfileSchema,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  asGiven,
  changes,
  formOf,
  type ProfileForm,
  profileMessage,
  profileOf,
  withSettings,
} from "./settings.ts";

type Init = MessageInitShape<typeof ProfileSchema>;

function profile(init: Init = {}) {
  const defaults: Init = {
    profileId: "p1",
    owner: true,
    pseudonym: "Ёжик",
    ageCategory: "adult",
    defaultMode: Mode.BY_STEPS,
    presentationStyle: { voicing: { enabled: false, speed: VoicingSpeed.NORMAL } },
  };
  return create(ProfileSchema, { ...defaults, ...init } as Init);
}

describe("formOf", () => {
  it("shows the profile's settings as the build reads them", () => {
    expect(
      formOf(
        profile({
          defaultMode: Mode.SELF,
          interfaceLanguage: "ru",
          presentationStyle: { voicing: { enabled: true, speed: VoicingSpeed.SLOW } },
        }),
      ),
    ).toEqual({
      pseudonym: "Ёжик",
      defaultMode: Mode.SELF,
      language: "ru",
      voicing: true,
      speed: VoicingSpeed.SLOW,
    });
  });

  it("reads a value it does not know as the contract says, and a tag by its language", () => {
    const form = formOf(
      profile({ defaultMode: 7 as Mode, interfaceLanguage: "ru-RU", presentationStyle: {} }),
    );
    expect(form).toMatchObject({
      defaultMode: Mode.BY_STEPS,
      language: "ru",
      voicing: false,
      speed: VoicingSpeed.NORMAL,
    });
    expect(formOf(profile({ interfaceLanguage: "de" })).language).toBeUndefined();
    expect(formOf(profile()).language).toBeUndefined();
  });
});

describe("changes", () => {
  const same = (of = profile()): ProfileForm => formOf(of);

  it("is none when nothing changed", () => {
    expect(changes(profile(), same())).toBeUndefined();
  });

  it("names only the fields that changed", () => {
    expect(changes(profile(), { ...same(), defaultMode: Mode.SELF })).toEqual({
      defaultMode: Mode.SELF,
    });
    expect(changes(profile(), { ...same(), pseudonym: "Ёж", language: "en" })).toEqual({
      pseudonym: "Ёж",
      interfaceLanguage: "en",
    });
  });

  it("names whether voicing is on apart from its speed", () => {
    expect(changes(profile(), { ...same(), voicing: true })).toEqual({
      voicing: { enabled: true },
    });
    expect(changes(profile(), { ...same(), speed: VoicingSpeed.SLOW })).toEqual({
      voicing: { speed: VoicingSpeed.SLOW },
    });
  });

  it("never writes back a value the build reads its own way, unless the adult changed it", () => {
    const unknown = profile({ defaultMode: 7 as Mode, interfaceLanguage: "ru-RU" });
    expect(changes(unknown, same(unknown))).toBeUndefined();
    const german = profile({ interfaceLanguage: "de" });
    expect(changes(german, same(german))).toBeUndefined();
    expect(changes(german, { ...same(german), language: "ru" })).toEqual({
      interfaceLanguage: "ru",
    });
  });
});

describe("withSettings", () => {
  it("takes the profile api gave, and keeps the open attempt and lesson runs as the tab has them", () => {
    const before = profile({
      interfaceLanguage: "ru",
      grade: 3,
      openAttempt: { attemptId: "a1" },
      openLessonRuns: [{ lessonRunId: "r1" }],
    } as Init);
    const from = profile({
      pseudonym: "Ёж",
      defaultMode: Mode.SELF,
      workStorage: true,
      openAttempt: { attemptId: "a9" },
    } as Init);
    const after = withSettings(before, from);
    expect(after).toMatchObject({ pseudonym: "Ёж", defaultMode: Mode.SELF, workStorage: true });
    expect(after.openAttempt?.attemptId).toBe("a1");
    expect(after.openLessonRuns.map((run) => run.lessonRunId)).toEqual(["r1"]);
    expect("openAttempt" in withSettings(profile(), from)).toBe(false);
    // An optional field api gave absent is no field at all.
    expect("interfaceLanguage" in after).toBe(false);
    expect("grade" in after).toBe(false);
    expect(withSettings(before, create(ProfileSchema, { profileId: "p1" }))).not.toHaveProperty(
      "presentationStyle",
    );
  });

  it("stays the profile GetAccount gave, however many settings it took since", () => {
    const given = profile();
    const once = withSettings(given, profile({ pseudonym: "Ёж" }));
    const twice = withSettings(once, profile({ pseudonym: "Ёжик" }));
    expect(asGiven(given)).toBe(given);
    expect(asGiven(once)).toBe(given);
    expect(asGiven(twice)).toBe(given);
  });
});

describe("the message of a profile changed", () => {
  it("carries the profile in binary, and gives it back", () => {
    const sent = profile({ pseudonym: "Ёж", interfaceLanguage: "ru" });
    const message = profileMessage(sent);
    expect(message.profile).toBeInstanceOf(Uint8Array);
    expect(profileOf(structuredClone(message))).toMatchObject({
      profileId: "p1",
      pseudonym: "Ёж",
      interfaceLanguage: "ru",
    });
  });

  it("is none for what is not one", () => {
    expect(profileOf("ru")).toBeUndefined();
    expect(profileOf(null)).toBeUndefined();
    expect(profileOf({ profile: "p1" })).toBeUndefined();
    expect(profileOf({ profile: new Uint8Array([0xff, 0xff, 0xff]) })).toBeUndefined();
  });
});
