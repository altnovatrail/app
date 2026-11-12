// The legal pages (R31 in docs/decisions.md; sections 3.8, 3.9 and 3.10 of docs/architecture.md):
// their list, `#/legal`, and each page, `#/legal/<page>` — the privacy policy, the terms of use and
// the consent to keeping works, as GetLegalTexts gives them in force; the page Accessibility; and
// the notices of third-party code, NOTICE and LICENSE of the build (R25). They show before signing
// in as well as after, in the language of the device (R10), below a bar that names them, leads
// back to their list and closes them back to where they were opened from. Nothing on them leads
// out of app (privacy 7 in spec): a text's own words lead nowhere (R27), and the operator of the
// copy, whom the page Accessibility names for a problem, is reached as the privacy policy says.
import type { LegalText as Text } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { type ReactNode, useCallback, useEffect, useId } from "react";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { PageBar } from "../app/PageBar.tsx";
import { LEGAL, navigate, type Route, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Language } from "../i18n/language.ts";
import { LegalContent } from "./LegalText.tsx";
import { LICENSE, NOTICE } from "./notices.ts";
import { isPageText, PAGE_TEXTS, type PageText, readTexts } from "./texts.ts";

/** The page Accessibility (R11). */
export const ACCESSIBILITY = "accessibility";
/** The page of the notices of third-party code (R25). */
export const NOTICES = "notices";

/** A legal page: a text's by its ID, or one of the two above. */
export type LegalPage = PageText | typeof ACCESSIBILITY | typeof NOTICES;

/** The legal pages in the order of their list. */
const PAGES: readonly LegalPage[] = [...PAGE_TEXTS, ACCESSIBILITY, NOTICES];

/** The route of a legal page. */
export function legalPage(page: LegalPage): Route {
  return { screen: LEGAL.screen, parts: [page] };
}

/** The places where the app does not meet its standard yet, as R11 declares them. */
const GAPS = ["handwriting", "print", "check"] as const;

/** The day a version came into force, `YYYY-MM-DD`, as the screen's language writes it. */
export function dayText(language: Language, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const date = new Date(`${day}T00:00:00Z`);
  // A day the calendar does not have, such as 02-30, which the engine would roll over: as it came.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return day;
  return dateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(date);
}

/** The bar above each legal page: their name, the way to their list, and back out of them. */
function LegalBar({ first, back }: { readonly first: boolean; readonly back: Route }) {
  const { words } = useLanguage();
  return (
    <PageBar
      title={words.text("legal.title")}
      {...(first ? {} : { back: { text: words.text("legal.back"), to: LEGAL } })}
      close={{ text: words.text("legal.close"), to: back }}
    />
  );
}

/** The list: a button for each page. */
export function LegalHome() {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("legal.title")}>
      <p>{words.text("legal.intro")}</p>
      <ul className="nt-buttons">
        {PAGES.map((page) => (
          <li key={page}>
            <button type="button" onClick={() => navigate(legalPage(page))}>
              {words.text(`legal.${page}`)}
            </button>
          </li>
        ))}
      </ul>
    </Screen>
  );
}

/**
 * A legal text as a page: its version and the day it came into force, then what the text holds,
 * open — the gist, the line that the English text is in force, the translation and the body. The
 * text is read in the language of the screen each time the page opens, past the HTTP cache (R27).
 */
export function TextPage({ id }: { readonly id: PageText }) {
  const { language, words } = useLanguage();
  const read = useCallback(
    async (api: Api): Promise<Text | undefined> =>
      (await readTexts(api, language)).find((text) => text.id === id),
    [language, id],
  );
  const text = useRequest(read);
  let shown: ReactNode = null;
  if (text.status === "failed") {
    shown = <ReadFailure failure={text.failure} onRetry={text.retry} />;
  } else if (text.status === "done") {
    shown =
      text.value === undefined ? (
        <p>{words.text("legal.none")}</p>
      ) : (
        <>
          <p>
            {words.text("legal.version", {
              version: String(text.value.version),
              date: dayText(language, text.value.inForceSince),
            })}
          </p>
          <LegalContent text={text.value} level={2} />
        </>
      );
  }
  return <Screen title={words.text(`legal.${id}`)}>{shown}</Screen>;
}

/**
 * The page Accessibility (R11; section 3.9 of docs/architecture.md): the standard, each place where
 * the app does not meet it yet — its criteria, why, what there is instead and when it goes — in
 * the set of the 2026-11-12 amendment to R11, how it is checked, and whom to write to: the
 * operator of this copy, whose contacts its privacy policy gives (R115, R131 in spec).
 */
export function AccessibilityPage() {
  const { words } = useLanguage();
  const id = useId();
  return (
    <Screen title={words.text("legal.accessibility")}>
      <h2>{words.text("accessibility.standard")}</h2>
      <p>{words.text("accessibility.standard-text")}</p>
      <h2>{words.text("accessibility.gaps")}</h2>
      <p>{words.text("accessibility.partly")}</p>
      {GAPS.map((gap) => (
        <section key={gap} aria-labelledby={`${id}-${gap}`}>
          <h3 id={`${id}-${gap}`}>{words.text(`accessibility.${gap}`)}</h3>
          <dl className="nt-terms">
            <dt>{words.text("accessibility.criteria")}</dt>
            <dd>{words.text(`accessibility.${gap}-criteria`)}</dd>
            <dt>{words.text("accessibility.why")}</dt>
            <dd>{words.text(`accessibility.${gap}-why`)}</dd>
            <dt>{words.text("accessibility.instead")}</dt>
            <dd>{words.text(`accessibility.${gap}-instead`)}</dd>
            <dt>{words.text("accessibility.when")}</dt>
            <dd>{words.text(`accessibility.${gap}-when`)}</dd>
          </dl>
        </section>
      ))}
      <h2>{words.text("accessibility.checked")}</h2>
      <p>{words.text("accessibility.checked-text")}</p>
      <h2>{words.text("accessibility.contact")}</h2>
      <p>{words.text("accessibility.contact-text")}</p>
      <div className="nt-buttons">
        <button type="button" onClick={() => navigate(legalPage("privacy-policy"))}>
          {words.text("accessibility.policy")}
        </button>
      </div>
    </Screen>
  );
}

/** The notices of third-party code: NOTICE and LICENSE of this build, in English, as they are. */
export function NoticesPage() {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("legal.notices")}>
      <p>{words.text("legal.notices-intro")}</p>
      <h2>{words.text("legal.notice-file")}</h2>
      <pre lang="en" className="nt-notice">
        {NOTICE}
      </pre>
      <h2>{words.text("legal.license-file")}</h2>
      <pre lang="en" className="nt-notice">
        {LICENSE}
      </pre>
    </Screen>
  );
}

/**
 * The legal pages by the hash: a page this build does not know — a family's text among them, whose
 * page comes with its screens in E4 — goes to their list in place of itself.
 */
export function LegalPages({ route, back }: { readonly route: Route; readonly back: Route }) {
  const page = route.parts.join("/");
  let shown: ReactNode;
  if (page === "") shown = <LegalHome />;
  else if (isPageText(page)) shown = <TextPage key={page} id={page} />;
  else if (page === ACCESSIBILITY) shown = <AccessibilityPage />;
  else if (page === NOTICES) shown = <NoticesPage />;
  const known = shown !== undefined;
  useEffect(() => {
    if (!known) redirect(LEGAL);
  }, [known]);
  if (!known) return null;
  return (
    <>
      <LegalBar first={page === ""} back={back} />
      {shown}
    </>
  );
}
