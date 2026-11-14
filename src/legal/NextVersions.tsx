// The next versions of the legal texts after signing in (R46 in docs/decisions.md; section 15 of the
// text of the contracts, "The legal texts"; sources 3.11 in spec): on the choice of the learner,
// which the adult sees at each start, and on the first page of the section for adults, each next
// version of a text that is a legal page with the day it applies from and the way to its page, and,
// while a profile keeps its works on the server, that this can be switched off before then. An api
// that gives no next version, and a read that failed, show nothing: the texts' own pages say the
// rest, and the next start reads them again.
import { useCallback, useId } from "react";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import type { Route } from "../app/router.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { nextPage } from "./LegalPages.tsx";
import { dayText, pageNext, readLegal } from "./texts.ts";

export function NextVersions({
  storing,
  onRead,
}: {
  /** Whether a profile of the account keeps its works on the server. */
  readonly storing: boolean;
  /** Opens the page of a next version, whose bar comes back here. */
  readonly onRead: (page: Route) => void;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const read = useCallback(
    async (api: Api) => pageNext((await readLegal(api, language)).next),
    [language],
  );
  const next = useRequest(read);
  if (next.status !== "done" || next.value.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{words.text("legal.next-title")}</h2>
      {next.value.map((text) => {
        const version = String(text.version);
        const name = words.text(`legal.${text.id}`);
        return (
          <div key={text.id}>
            <p id={`${id}-${text.id}`}>
              {words.text("legal.next-line", {
                text: name,
                version,
                date: dayText(language, text.inForceSince),
              })}
            </p>
            <div className="nt-buttons">
              <button
                type="button"
                aria-describedby={`${id}-${text.id}`}
                onClick={() => onRead(nextPage(text.id))}
              >
                {words.text("legal.next-open", { text: name, version })}
              </button>
            </div>
          </div>
        );
      })}
      {storing ? <p>{words.text("legal.next-storage")}</p> : null}
    </section>
  );
}
