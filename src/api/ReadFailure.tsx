// A read that did not come, in place of what it would have shown (R18 in docs/decisions.md): the
// words of what it came to, as an alert, and Try again below them. A whole screen whose read
// failed is ReadFailed of src/boot/Screens.tsx; this is a part of a screen.
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Failure } from "./failure.ts";
import { failureText } from "./words.ts";

export function ReadFailure({
  failure,
  onRetry,
}: {
  readonly failure: Failure;
  readonly onRetry: () => void;
}) {
  const { words } = useLanguage();
  return (
    <div className="nt-field">
      <p role="alert" className="nt-error">
        {failureText(failure, words)}
      </p>
      <button type="button" onClick={onRetry}>
        {words.text("boot.retry")}
      </button>
    </div>
  );
}
