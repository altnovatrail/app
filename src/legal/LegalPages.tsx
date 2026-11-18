// The legal pages (R31 and R46 in docs/decisions.md; sections 3.8, 3.9 and 3.10 of
// docs/architecture.md): their list, `#/legal`, and each page, `#/legal/<page>` — the privacy
// policy, the terms of use and the consent to keeping works, as GetLegalTexts gives them in force,
// and the next version of each, `#/legal/<text>/next`, before the day it applies from; who runs
// this copy, `#/legal/operator` — the section Who we are of the privacy policy in force; the page
// Accessibility; and the notices of third-party code, NOTICE and LICENSE of the build (R25). They
// show before signing in as well as after, in the language of the device (R10), each a sheet of the
// mockup's legal text (R69) whose head leads back to their list and closes them back to where they
// were opened from. Nothing on them leads out of app (privacy 7 in spec): a text's own words lead
// nowhere (R27), and the operator of the copy, whom a page names, is reached as the section Who we
// are says.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
} from "react";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { LEGAL, navigate, type Route, redirect } from "../app/router.ts";
import { SheetScreen } from "../app/SheetScreen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { OPERATOR_SECTION, sectionOf } from "./body.ts";
import { LegalContent, LegalOriginal } from "./LegalText.tsx";
import { LICENSE, NOTICE } from "./notices.ts";
import {
  dayText,
  isPageText,
  PAGE_TEXTS,
  type PageText,
  readLegal,
  type Versions,
  versionsOf,
} from "./texts.ts";

/** The page Accessibility (R11). */
export const ACCESSIBILITY = "accessibility";
/** The page of the notices of third-party code (R25). */
export const NOTICES = "notices";
/** The page of who runs this copy: the section Who we are of the privacy policy in force (R46). */
export const OPERATOR = "operator";
/** The part of the hash after a text's ID that names its next version (R46). */
const NEXT = "next";

/** A legal page: a text's by its ID, or one of the three above. */
export type LegalPage = PageText | typeof OPERATOR | typeof ACCESSIBILITY | typeof NOTICES;

/** The legal pages in the order of their list. */
const PAGES: readonly LegalPage[] = [...PAGE_TEXTS, OPERATOR, ACCESSIBILITY, NOTICES];

/** The route of a legal page. */
export function legalPage(page: LegalPage): Route {
  return { screen: LEGAL.screen, parts: [page] };
}

/** The route of the page of a text's next version. */
export function nextPage(id: PageText): Route {
  return { screen: LEGAL.screen, parts: [id, NEXT] };
}

/** The policy whose section Who we are names the operator of the copy (R115 spec). */
const POLICY: PageText = "privacy-policy";

/** The places where the app does not meet its standard yet, as R11 declares them. */
const GAPS = ["handwriting", "moving", "print", "check"] as const;

/** Where a page stands among the legal pages: their list or another, and where they close to. */
interface LegalPlace {
  readonly first: boolean;
  readonly back: Route;
}

const Place = createContext<LegalPlace | undefined>(undefined);

/**
 * A legal page's sheet: its heading, the chip under it, the way to their list on any page but the
 * list, and the close back out of them. A page drawn alone, as its tests draw one, has neither.
 */
function LegalScreen({
  title,
  chip,
  children,
}: {
  readonly title: string;
  readonly chip?: string;
  readonly children?: ReactNode;
}) {
  const place = useContext(Place);
  return (
    <SheetScreen
      title={title}
      {...(chip === undefined ? {} : { chip })}
      {...(place === undefined
        ? {}
        : {
            back: place.first ? undefined : (
              <IconButton value="back" caption="legal.back" onClick={() => navigate(LEGAL)} />
            ),
            onClose: () => navigate(place.back),
          })}
    >
      {children}
    </SheetScreen>
  );
}

/** The list: a button for each page, as the links of the adult's Help (R69). */
export function LegalHome() {
  const { words } = useLanguage();
  return (
    <LegalScreen title={words.text("legal.title")}>
      <p>{words.text("legal.intro")}</p>
      <ul className="nt-sheet-list">
        {PAGES.map((page) => (
          <li key={page}>
            <button type="button" className="nt-link" onClick={() => navigate(legalPage(page))}>
              {words.text(`legal.${page}`)}
            </button>
          </li>
        ))}
      </ul>
    </LegalScreen>
  );
}

/**
 * The versions of a text, read in the language of the screen each time its page opens, past the
 * HTTP cache (R27); a failure is its words and Try again.
 */
function useVersions(id: PageText) {
  const { language } = useLanguage();
  const read = useCallback(
    async (api: Api): Promise<Versions> => versionsOf(await readLegal(api, language), id),
    [language, id],
  );
  return useRequest(read);
}

/**
 * A legal text as a page: its version and the day it came into force in the chip under its heading;
 * then what the text holds, open — the gist below its caption; its next version, if it has one, with
 * the day it applies from and the way to its page, in a note, where the mockup has it; the line that
 * the English text is in force, the translation and the body.
 */
export function TextPage({ id }: { readonly id: PageText }) {
  const { language, words } = useLanguage();
  const hint = useId();
  const versions = useVersions(id);
  let shown: ReactNode = null;
  let chip: string | undefined;
  if (versions.status === "failed") {
    shown = <ReadFailure failure={versions.failure} onRetry={versions.retry} />;
  } else if (versions.status === "done") {
    const { current, next } = versions.value;
    if (current !== undefined) {
      chip = words.text("legal.version", {
        version: String(current.version),
        date: dayText(language, current.inForceSince),
      });
    }
    const note =
      next === undefined ? null : (
        <div className="nt-sheet-note">
          <p id={hint}>
            {words.text("legal.next-coming", {
              version: String(next.version),
              date: dayText(language, next.inForceSince),
            })}
          </p>
          <button
            type="button"
            className="nt-link"
            aria-describedby={hint}
            onClick={() => navigate(nextPage(id))}
          >
            {words.text("legal.next-read", { version: String(next.version) })}
          </button>
        </div>
      );
    shown =
      current === undefined ? (
        <>
          <p>{words.text("legal.none")}</p>
          {note}
        </>
      ) : (
        <LegalContent text={current} level={2} captioned note={note} />
      );
  }
  return (
    <LegalScreen title={words.text(`legal.${id}`)} {...(chip === undefined ? {} : { chip })}>
      {shown}
    </LegalScreen>
  );
}

/**
 * A text's next version as a page of its own, before the day it applies from (R46): that day, the
 * version in force until then and the way back to it, what can be withdrawn before it, and what
 * the version holds, open, as the page of the current one shows it.
 */
export function NextTextPage({ id }: { readonly id: PageText }) {
  const { language, words } = useLanguage();
  const versions = useVersions(id);
  const back = (
    <div className="nt-buttons">
      <button type="button" className="nt-secondary" onClick={() => navigate(legalPage(id))}>
        {words.text("legal.current-read")}
      </button>
    </div>
  );
  let shown: ReactNode = null;
  if (versions.status === "failed") {
    shown = <ReadFailure failure={versions.failure} onRetry={versions.retry} />;
  } else if (versions.status === "done") {
    const { current, next } = versions.value;
    shown =
      next === undefined ? (
        <>
          <p>{words.text("legal.next-none")}</p>
          {back}
        </>
      ) : (
        <>
          <p>
            {words.text("legal.next-version", {
              version: String(next.version),
              date: dayText(language, next.inForceSince),
            })}
          </p>
          {current === undefined ? null : (
            <p>{words.text("legal.next-until", { version: String(current.version) })}</p>
          )}
          <p>{words.text("legal.next-withdraw")}</p>
          {current === undefined ? null : back}
          <LegalContent text={next} level={2} />
        </>
      );
  }
  return (
    <LegalScreen title={words.text("legal.next-page", { text: words.text(`legal.${id}`) })}>
      {shown}
    </LegalScreen>
  );
}

/**
 * Who runs this copy (R46; the 2026-11-12 amendment to R115 spec): the section Who we are of the
 * privacy policy in force, in English as it is — the contract has no field for the operator —,
 * with the version it comes from and the way to the whole policy. A policy with no such section,
 * and a copy with no policy in force, say so.
 */
export function OperatorPage() {
  const { language, words } = useLanguage();
  const versions = useVersions(POLICY);
  let shown: ReactNode = null;
  if (versions.status === "failed") {
    shown = <ReadFailure failure={versions.failure} onRetry={versions.retry} />;
  } else if (versions.status === "done") {
    const policy = versions.value.current;
    const section = policy === undefined ? undefined : sectionOf(policy.body, OPERATOR_SECTION);
    shown =
      policy === undefined ? (
        <p>{words.text("legal.operator-no-policy")}</p>
      ) : (
        <>
          <p>
            {words.text("legal.operator-from", {
              version: String(policy.version),
              date: dayText(language, policy.inForceSince),
            })}
          </p>
          {section === undefined ? (
            <p>{words.text("legal.operator-none")}</p>
          ) : (
            <>
              {language === "en" ? null : (
                <p className="nt-in-force">{words.text("legal.english-in-force")}</p>
              )}
              <LegalOriginal body={section} level={1} />
            </>
          )}
          <div className="nt-buttons">
            <button type="button" onClick={() => navigate(legalPage(POLICY))}>
              {words.text("legal.operator-policy")}
            </button>
          </div>
        </>
      );
  }
  return <LegalScreen title={words.text("legal.operator")}>{shown}</LegalScreen>;
}

/**
 * The page Accessibility (R11; section 3.9 of docs/architecture.md): the standard, each place where
 * the app does not meet it yet — its criteria, why, what there is instead and when it goes — in
 * the set of the 2026-11-12 amendment to R11, how it is checked, and whom to write to: the
 * operator of this copy, whose contacts the section Who we are of its privacy policy gives (R115,
 * R131 spec; R46).
 */
export function AccessibilityPage() {
  const { words } = useLanguage();
  const id = useId();
  return (
    <LegalScreen title={words.text("legal.accessibility")} chip={words.text("accessibility.level")}>
      <h2 className="nt-sheet-caption">{words.text("accessibility.standard")}</h2>
      <p>{words.text("accessibility.standard-text")}</p>
      <h2 className="nt-sheet-caption">{words.text("accessibility.gaps")}</h2>
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
      <h2 className="nt-sheet-caption">{words.text("accessibility.checked")}</h2>
      <p>{words.text("accessibility.checked-text")}</p>
      <h2 className="nt-sheet-caption">{words.text("accessibility.contact")}</h2>
      <p>{words.text("accessibility.contact-text")}</p>
      <div className="nt-buttons">
        <button type="button" onClick={() => navigate(legalPage(OPERATOR))}>
          {words.text("accessibility.operator")}
        </button>
      </div>
    </LegalScreen>
  );
}

/** The notices of third-party code: NOTICE and LICENSE of this build, in English, as they are. */
export function NoticesPage() {
  const { words } = useLanguage();
  return (
    <LegalScreen title={words.text("legal.notices")}>
      <p>{words.text("legal.notices-intro")}</p>
      <h2>{words.text("legal.notice-file")}</h2>
      <pre lang="en" className="nt-notice">
        {NOTICE}
      </pre>
      <h2>{words.text("legal.license-file")}</h2>
      <pre lang="en" className="nt-notice">
        {LICENSE}
      </pre>
    </LegalScreen>
  );
}

/**
 * The legal pages by the hash: a page this build does not know — a family's text among them, whose
 * page comes with its screens in E4 — goes to their list in place of itself.
 */
export function LegalPages({ route, back }: { readonly route: Route; readonly back: Route }) {
  const page = route.parts.join("/");
  const [first = "", ...rest] = route.parts;
  let shown: ReactNode;
  if (page === "") shown = <LegalHome />;
  else if (isPageText(page)) shown = <TextPage key={page} id={page} />;
  else if (isPageText(first) && rest.join("/") === NEXT) {
    shown = <NextTextPage key={first} id={first} />;
  } else if (page === OPERATOR) shown = <OperatorPage />;
  else if (page === ACCESSIBILITY) shown = <AccessibilityPage />;
  else if (page === NOTICES) shown = <NoticesPage />;
  const known = shown !== undefined;
  const list = page === "";
  const place = useMemo(() => ({ first: list, back }), [list, back]);
  useEffect(() => {
    if (!known) redirect(LEGAL);
  }, [known]);
  if (!known) return null;
  return <Place.Provider value={place}>{shown}</Place.Provider>;
}
