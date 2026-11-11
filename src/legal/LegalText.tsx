// A legal text as app shows it, in place (section 3.8 of docs/architecture.md; section 15 of the
// text of the contracts; R27 in docs/decisions.md): its title, which opens it; its gist in the
// language api found, with that `lang`; on a screen in another language than English, the line
// that the English text is the one in force and the version's translation, when it has one, which
// has no force of its own (R141 in spec); and the English body, `lang="en"`. Nothing in it leads
// out of app.
import type { LegalText as Text } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { useMemo } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { titleOf } from "./body.ts";
import { Markdown } from "./Markdown.tsx";

/** A text, closed until it is opened; its own headings begin at `level`. */
export function LegalText({ text, level }: { readonly text: Text; readonly level: number }) {
  const { language, words } = useLanguage();
  const translated = text.translation !== "" && text.translationLanguage !== "";
  const title = useMemo(() => titleOf(text.body) ?? text.id, [text.body, text.id]);
  return (
    <details className="nt-legal">
      <summary>
        <span lang="en">{title}</span>
      </summary>
      <section aria-label={words.text("legal.gist")}>
        <p lang={text.summaryLanguage === "" ? "en" : text.summaryLanguage}>{text.summary}</p>
      </section>
      {language === "en" ? null : <p>{words.text("legal.english-in-force")}</p>}
      {translated ? (
        <section aria-label={words.text("legal.translation")} lang={text.translationLanguage}>
          <p lang={language}>{words.text("legal.translation")}</p>
          <Markdown body={text.translation} level={level} />
        </section>
      ) : null}
      <section aria-label={words.text("legal.original")} lang="en">
        {translated ? <p lang={language}>{words.text("legal.original")}</p> : null}
        <Markdown body={text.body} level={level} />
      </section>
    </details>
  );
}
