// A legal text as app shows it, in place (the contract; R27): its title, which opens it; its gist
// in the language api found, with that `lang`; on a screen in another language than English, the
// line that the English text is the one in force and the version's translation, when it has one,
// which has no force of its own (R141 spec); and the English body, `lang="en"`. Nothing in it leads
// out of app. The legal pages show the same, open (R31). A text's next version, which does not
// apply yet, shows in place below it, closed too, with the day it applies from (R46).
import type { LegalText as Text } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { type ReactNode, useId, useMemo } from "react";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { titleOf } from "./body.ts";
import { Markdown } from "./Markdown.tsx";
import { dayText } from "./texts.ts";

/**
 * A legal text open on its page while it is read (R168 spec): the caption and the lines of its
 * gist, and with `body` the heading and the first lines of the text below.
 */
export function LegalLoading({ body = true }: { readonly body?: boolean }) {
  return (
    <Loading>
      <Sk width="4.5rem" height="0.75rem" radius="0.25rem" />
      <Sk width="100%" height="0.9375rem" radius="0.3125rem" />
      <Sk width="94%" height="0.9375rem" radius="0.3125rem" />
      <Sk width="68%" height="0.9375rem" radius="0.3125rem" />
      {body ? (
        <>
          <Sk
            width="45%"
            height="1.25rem"
            radius="0.375rem"
            style={{ marginBlockStart: "0.75rem" }}
          />
          {["100%", "97%", "99%", "82%"].map((width) => (
            <Sk key={width} width={width} height="0.875rem" radius="0.3125rem" />
          ))}
        </>
      ) : null}
    </Loading>
  );
}

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
 * open, as a page of its own (R31): the gist below its caption, as the mockup's legal text has it,
 * and their `note` below the gist — the next version's (R69).
 */
export function LegalContent({
  text,
  level,
  captioned = false,
  note = null,
}: {
  readonly text: Text;
  readonly level: number;
  /** The gist below its caption, which names it, in place of a name alone. */
  readonly captioned?: boolean;
  readonly note?: ReactNode;
}) {
  const { language, words } = useLanguage();
  const caption = useId();
  const translated = text.translation !== "" && text.translationLanguage !== "";
  return (
    <>
      <section
        className="nt-gist"
        {...(captioned
          ? { "aria-labelledby": caption }
          : { "aria-label": words.text("legal.gist") })}
      >
        {captioned ? (
          <p id={caption} className="nt-sheet-caption">
            {words.text("legal.gist")}
          </p>
        ) : null}
        <p lang={text.summaryLanguage === "" ? "en" : text.summaryLanguage}>{text.summary}</p>
      </section>
      {note}
      {language === "en" ? null : (
        <p className="nt-in-force">{words.text("legal.english-in-force")}</p>
      )}
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
