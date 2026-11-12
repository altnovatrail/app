// Voicing on or off on the task screen (R07 and R36 in docs/decisions.md;
// section 3.5 of docs/architecture.md; section 15 of the text of the contracts): `SetVoicing`, a
// learning request, so that the learner sets it as the adult does on the profile's page, and it
// holds on every device. The answer is the profile, which the session takes and the other tabs hear
// of, as a change of the section for adults. Off, speech stops at once. On, where the tutor's words
// cannot be said on this device, a line says why. Outside a learner's screens there is no button.
import { useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { ApiError, type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useSilentLine } from "./ReadAloud.tsx";
import { useVoicing } from "./VoicingContext.tsx";

export function VoicingToggle({
  language,
}: {
  /** The language of the tutor's words, the module's explanation language. */
  readonly language: string | undefined;
}) {
  const { profile } = useVoicing();
  return profile === undefined ? null : (
    <Toggle profileId={profile.profileId} language={language} />
  );
}

function Toggle({
  profileId,
  language,
}: {
  readonly profileId: string;
  readonly language: string | undefined;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const voicing = useVoicing();
  const lineOf = useSilentLine();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const { on, onSaved, onFailed } = voicing;
  const silent = on ? voicing.silent(language) : undefined;
  // Not known yet is no line: it would only flash.
  const why = silent === "wait" ? undefined : silent;

  async function toggle(to: boolean) {
    setPending(true);
    setFailure(undefined);
    if (!to) voicing.speech.stop();
    try {
      const answer = await api.account.setVoicing({ profileId, voicing: { enabled: to } });
      if (answer.profile === undefined) throw new ApiError({ kind: "invalid" });
      onSaved?.(answer.profile);
    } catch (reason) {
      const failed = parseFailure(reason);
      setFailure(failed);
      onFailed?.(failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="nt-voicing">
      <div className="nt-buttons">
        {/* Not disabled while it is under way: a disabled button would drop the focus. */}
        <button
          type="button"
          className="nt-secondary"
          aria-pressed={on}
          aria-disabled={pending}
          onClick={() => {
            if (!pending) void toggle(!on);
          }}
        >
          {words.text("voice.toggle")}
        </button>
      </div>
      {why === undefined ? null : <p className="nt-hint">{lineOf(why, language)}</p>}
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
    </div>
  );
}
