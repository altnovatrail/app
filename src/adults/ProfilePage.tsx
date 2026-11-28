// A profile's page in Settings, the section for adults: what an adult sets of the profile — its
// avatar, its pseudonym, its hint mode and its voicing — in one form of grouped lists, saved by
// Save in the page's bar with `UpdateProfile` and only the fields that changed. A choice — a
// tick, a switch, a segment, a value in its pop-over, the avatar in its own — changes nothing
// until Save (WCAG 3.2.2), which waits for a change and says Saved once it has gone. What
// another tab changed meanwhile shows in the fields not edited here; what is edited here stays
// until it is saved — an edit made while the request was on its way among them. A failure that
// is the session's own goes to it as well
// (`onFailed`). Below the form, the storage of the profile's works on the server, a consent of its
// own, and the share of today's tutor time the profile and the account have used (the contract's
// quota). While the form holds changes not saved, a press that would leave the page asks first:
// Save sends them and goes on once they have gone, else stays with why; Don't Save drops them and
// goes on; Cancel stays.
import {
  HintMode,
  type Profile,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type FormEvent, useId, useRef, useState } from "react";
import { AvatarChoice } from "../account/AvatarChoice.tsx";
import { pseudonymOf } from "../account/session.ts";
import { changes, formOf, type ProfileForm } from "../account/settings.ts";
import { useApi } from "../api/ApiContext.tsx";
import { ApiError, type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { described } from "../app/described.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Device } from "../storage/device.ts";
import { useHold } from "./leave.tsx";
import { QuotaSection } from "./QuotaSection.tsx";
import { Group, SegmentsRow, SwitchRow, TickRow } from "./rows.tsx";
import { SectionScreen } from "./SectionScreen.tsx";
import { UnsavedDialog } from "./UnsavedDialog.tsx";
import { WorkStorage } from "./WorkStorage.tsx";

/** What the adult changed on the page and has not saved: the pseudonym as typed. */
type Edits = Partial<Omit<ProfileForm, "pseudonym">> & { readonly pseudonym?: string };

/** The edits of `now` that are not the ones sent: those the adult made while the request was away. */
function unsent(now: Edits, sent: Edits): Edits {
  return Object.fromEntries(
    Object.entries(now).filter(([key, value]) => sent[key as keyof Edits] !== value),
  ) as Edits;
}

export function ProfilePage({
  profile,
  device,
  onSaved,
  onFailed,
}: {
  readonly profile: Profile;
  /** The device whose works of the profile its storage on the server sends. */
  readonly device: Device;
  /** api changed the profile: the profile as its answer gives it. */
  readonly onSaved: (profile: Profile) => void;
  /** The request did not go through: the page says why, and the session may move by it. */
  readonly onFailed: (failure: Failure) => void;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const id = useId();
  const pseudonymField = useRef<HTMLInputElement>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [pseudonymError, setPseudonymError] = useState(false);
  const [status, setStatus] = useState<"saved" | "unchanged" | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  /** Where a press would have gone, while the page asks whether to save first. */
  const [leaving, setLeaving] = useState<(() => void) | undefined>(undefined);
  const saved = formOf(profile);
  const pseudonym = edits.pseudonym ?? profile.pseudonym;
  const form: Omit<ProfileForm, "pseudonym"> = {
    avatar: edits.avatar ?? saved.avatar,
    voicing: edits.voicing ?? saved.voicing,
    speed: edits.speed ?? saved.speed,
    hintMode: edits.hintMode ?? saved.hintMode,
  };

  function edit(change: Edits) {
    setEdits((before) => ({ ...before, ...change }));
    setStatus(undefined);
  }

  /** Sends what changed: true once it has gone, or when nothing had changed. */
  async function send(): Promise<boolean> {
    const name = pseudonymOf(pseudonym);
    if (pending) return false;
    setPseudonymError(name === undefined);
    setFailure(undefined);
    setStatus(undefined);
    if (name === undefined) {
      pseudonymField.current?.focus();
      return false;
    }
    const settings = changes(profile, { ...form, pseudonym: name });
    if (settings === undefined) {
      setStatus("unchanged");
      return true;
    }
    const sent = edits;
    setPending(true);
    try {
      const answer = await api.account.updateProfile({ profileId: profile.profileId, settings });
      if (answer.profile === undefined) throw new ApiError({ kind: "invalid" });
      // What was sent is the profile's now; an edit made since stays an edit.
      setEdits((now) => unsent(now, sent));
      onSaved(answer.profile);
      setStatus("saved");
      return true;
    } catch (reason) {
      const failed = parseFailure(reason);
      setFailure(failed);
      onFailed(failed);
      return false;
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await send();
  }

  // Save waits for a change, and says Saved once one has gone and none is new.
  const name = pseudonymOf(pseudonym);
  const dirty = name === undefined || changes(profile, { ...form, pseudonym: name }) !== undefined;
  const off = pending || !dirty;
  const title = words.text("adults.profile", { pseudonym: profile.pseudonym });
  useHold(dirty, (go) => setLeaving(() => go));

  return (
    <SectionScreen
      title={title}
      action={
        // Not disabled: a disabled button would drop the focus once the form has gone.
        <button type="submit" form={`${id}-form`} className="nt-set-save" aria-disabled={off}>
          {status === "saved" && !dirty ? words.text("adults.saved") : words.text("adults.save")}
        </button>
      }
    >
      <div className="nt-set-hero">
        <AvatarChoice code={form.avatar} onChoose={(avatar) => edit({ avatar })}>
          <p className="nt-set-hero-name">{profile.pseudonym}</p>
          <p className="nt-set-hero-sub">
            {words.text(profile.owner ? "choose.owner" : "choose.learner")}
          </p>
        </AvatarChoice>
      </div>
      <form id={`${id}-form`} noValidate onSubmit={(event) => void submit(event)}>
        <Group
          label={words.text("profile.pseudonym")}
          note={
            <>
              <p id={`${id}-pseudonym-hint`}>{words.text("profile.pseudonym-hint")}</p>
              {pseudonymError ? (
                <p id={`${id}-pseudonym-error`} className="nt-error">
                  {words.text("profile.pseudonym-length")}
                </p>
              ) : null}
            </>
          }
        >
          <div className="nt-set-row nt-set-field">
            <label htmlFor={`${id}-pseudonym`} className="nt-set-label">
              {words.text("profile.pseudonym")}
            </label>
            <input
              ref={pseudonymField}
              id={`${id}-pseudonym`}
              type="text"
              autoComplete="off"
              value={pseudonym}
              aria-invalid={pseudonymError}
              aria-describedby={described(
                `${id}-pseudonym-hint`,
                pseudonymError && `${id}-pseudonym-error`,
              )}
              onChange={(event) => edit({ pseudonym: event.target.value })}
            />
          </div>
        </Group>
        <Group title={words.text("hints.title")}>
          <fieldset className="nt-set-choices">
            <legend className="nt-hidden-label">{words.text("hints.title")}</legend>
            <TickRow
              name={`${id}-hints`}
              label={words.text("hints.questions")}
              sub={words.text("hints.questions-line")}
              checked={form.hintMode === HintMode.QUESTIONS_ONLY}
              onChange={() => edit({ hintMode: HintMode.QUESTIONS_ONLY })}
            />
            <TickRow
              name={`${id}-hints`}
              label={words.text("hints.where")}
              sub={words.text("hints.where-line")}
              checked={form.hintMode === HintMode.SHOW_WHERE}
              onChange={() => edit({ hintMode: HintMode.SHOW_WHERE })}
            />
          </fieldset>
        </Group>
        <Group
          title={words.text("adults.voicing")}
          note={
            <div id={`${id}-voicing-hint`}>
              <p>{words.text("adults.voicing-device")}</p>
              <p>{words.text("adults.voicing-reader")}</p>
            </div>
          }
        >
          <SwitchRow
            label={words.text("adults.voicing-on")}
            checked={form.voicing}
            describedBy={`${id}-voicing-hint`}
            onChange={(voicing) => edit({ voicing })}
          />
          <SegmentsRow
            label={words.text("adults.speed")}
            value={form.speed}
            options={[
              [VoicingSpeed.NORMAL, words.text("adults.speed-normal")],
              [VoicingSpeed.SLOW, words.text("adults.speed-slow")],
            ]}
            onChange={(speed) => edit({ speed })}
          />
        </Group>
        <p role="status" className="nt-hidden-label">
          {status === undefined ? null : words.text(`adults.${status}`)}
        </p>
        {failure === undefined ? null : (
          <p role="alert" className="nt-error nt-set-alert">
            {failureText(failure, words)}
          </p>
        )}
      </form>
      <WorkStorage profile={profile} device={device} onSaved={onSaved} onFailed={onFailed} />
      <QuotaSection profile={profile} />
      {leaving === undefined ? null : (
        <UnsavedDialog
          line={
            profile.owner
              ? words.text("adults.unsaved-own")
              : words.text("adults.unsaved-line", { pseudonym: profile.pseudonym })
          }
          onSave={() => {
            setLeaving(undefined);
            void send().then((sent) => {
              if (sent) leaving();
            });
          }}
          onDrop={() => {
            setLeaving(undefined);
            setEdits({});
            leaving();
          }}
          onCancel={() => setLeaving(undefined)}
        />
      )}
    </SectionScreen>
  );
}
