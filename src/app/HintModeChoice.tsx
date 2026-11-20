// The hint mode in the profile's menu (R76; R162 spec), as the mockup's `home-switch`:
// a group of two radio buttons under "Hints" — "Questions only", and "Show where", whose wavy line after
// "Not yet" underlines the place of the mistake on a task from paper. A learner of the category
// adult sets their own by `SetHintMode`, a learning request, and the session takes the profile it
// answers; a child's is set by a grown-up on the profile's page, and here it is read only, "set by
// a grown-up".
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { HintMode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useId, useState } from "react";
import { hintModeOf } from "../account/settings.ts";
import { useApi } from "../api/ApiContext.tsx";
import { ApiError, type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The two modes in the menu's order, each with the keys of its title and its line. */
const MODES = [
  [HintMode.QUESTIONS_ONLY, "hints.questions", "hints.questions-line"],
  [HintMode.SHOW_WHERE, "hints.where", "hints.where-line"],
] as const;

export function HintModeChoice({
  learner,
  onSaved,
  onFailed,
}: {
  readonly learner: Profile;
  readonly onSaved: (profile: Profile) => void;
  readonly onFailed: (failure: Failure) => void;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const byAdult = learner.ageCategory !== "adult";
  const mode = hintModeOf(learner);

  async function choose(to: HintMode) {
    if (byAdult || pending || to === mode) return;
    setPending(true);
    setFailure(undefined);
    try {
      const answer = await api.account.setHintMode({ profileId: learner.profileId, hintMode: to });
      if (answer.profile === undefined) throw new ApiError({ kind: "invalid" });
      onSaved(answer.profile);
    } catch (reason) {
      const failed = parseFailure(reason);
      setFailure(failed);
      onFailed(failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <fieldset className="nt-hint-modes">
      <legend className="nt-menu-caption">
        {words.text("hints.title")}
        {byAdult ? <span className="nt-hint-modes-by">{words.text("hints.by-adult")}</span> : null}
      </legend>
      {MODES.map(([value, title, line]) => (
        <label key={value} className="nt-hint-mode">
          {/* Not disabled while it is under way, nor for a child: a disabled radio would drop the focus. */}
          <input
            type="radio"
            name={id}
            className="nt-hint-mode-input"
            checked={mode === value}
            aria-disabled={byAdult || pending}
            onChange={() => void choose(value)}
          />
          <span className="nt-hint-mode-title">{words.text(title)}</span>
          <span className="nt-hint-mode-line">{words.text(line)}</span>
        </label>
      ))}
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
    </fieldset>
  );
}
