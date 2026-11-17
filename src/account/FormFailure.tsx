// A failure a form of the way in shows below its button (section 3.10 of docs/architecture.md).
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";

export function FormFailure({ failure }: { readonly failure: Failure | undefined }) {
  const { words } = useLanguage();
  return failure === undefined ? null : (
    <p role="alert" className="nt-error">
      {failureText(failure, words)}
    </p>
  );
}
