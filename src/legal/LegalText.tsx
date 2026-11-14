// A legal text as app shows it, in place (section 3.8 of docs/architecture.md; section 15 of the
// text of the contracts; R27 in docs/decisions.md): its title, which opens it; its gist in the
// language api found, with that `lang`; on a screen in another language than English, the line
// that the English text is the one in force and the version's translation, when it has one, which
// has no force of its own (R141 in spec); and the English body, `lang="en"`. Nothing in it leads
// out of app. The legal pages show the same, open (R31). A text's next version, which does not
// apply yet, shows in place below it, closed too, with the day it applies from (R46).
import type { LegalText as Text } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { useMemo } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { titleOf } from "./body.ts";
import { Markdown } from "./Markdown.tsx";
import { dayText } from "./texts.ts";

/** A text, closed until it is opened; its own headings begin at `level`. */
export function LegalText({ text, level }: { readonly text: Text; readonly level: number }) {
  const title = useMemo(() => titleOf(text.body) ?? text.id, [text.body, text.id]);
  return (
    <details className="nt-legal">
      <summary>
        <span lang="en">{title}</span>
      </summary>
      <LegalContent text={text} level={level} />
    </details>
  );
}

/**
 * A text's next version, closed until it is opened: its title with the number of the version and
 * the day it applies from, and, while a current version is in force, that it is until then.
 */
export function NextLegalText({
  text,
  current,
  level,
}: {
  readonly text: Text;
  readonly current: Text | undefined;
  readonly level: number;
}) {
  const { language, words } = useLanguage();
  const title = useMemo(() => titleOf(text.body) ?? text.id, [text.body, text.id]);
  const version = String(text.version);
  return (
    <details className="nt-legal">
      <summary>
        <span lang="en">{title}</span>
        {": "}
        {words.text("legal.next-summary", { version, date: dayText(language, text.inForceSince) })}
      </summary>
      {current === undefined ? null : (
        <p>{words.text("legal.next-until", { version: String(current.version) })}</p>
      )}
      <LegalContent text={text} level={level} />
    </details>
  );
}

/**
 * What a text holds, below its title: the gist, the line that the English text is in force, the
 * translation and the English body, whose own headings begin at `level`. The legal pages show it
 * open, as a page of its own (R31).
 */
export function LegalContent({ text, level }: { readonly text: Text; readonly level: number }) {
  const { language, words } = useLanguage();
  const translated = text.translation !== "" && text.translationLanguage !== "";
  return (
    <>
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
      <LegalOriginal body={text.body} level={level} labelled={translated} />
    </>
  );
}

/**
 * A body in English, the text in force, whose own headings begin at `level`; below a translation,
 * it says that this is the original. The page of who runs the copy shows its section so (R46).
 */
export function LegalOriginal({
  body,
  level,
  labelled = false,
}: {
  readonly body: string;
  readonly level: number;
  readonly labelled?: boolean;
}) {
  const { language, words } = useLanguage();
  return (
    <section aria-label={words.text("legal.original")} lang="en">
      {labelled ? <p lang={language}>{words.text("legal.original")}</p> : null}
      <Markdown body={body} level={level} />
    </section>
  );
}
