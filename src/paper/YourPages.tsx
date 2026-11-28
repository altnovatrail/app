// "History" on the card "Tasks from my paper", the solving history, as the author's mockup
// `Vashi-stranicy-1a`:
// the profile's pages from paper this device keeps, the newest first, each a row with a thumbnail of
// its photo, when it was taken and how many tasks it began, behind a small button that opens a
// pop-over. A page opens on the screen of solving with its tasks and their work. The button
// stands while the device keeps no page too, as the mockup's: its pop-over says there is none yet.
import { useEffect, useState } from "react";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { navigate, PAPER } from "../app/router.ts";
import { Sk } from "../app/Skeleton.tsx";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Device } from "../storage/device.ts";
import { type KeptPhoto, MAX_PAGES, openProfile, type PageSummary } from "../storage/profile.ts";
import { thumbnailOf } from "./capture.ts";
import { usePaper } from "./PaperContext.tsx";

/**
 * The pages' thumbnails, each made once from its photo, read apart from the list, which reads none:
 * one after another, so that a long list holds one whole photo in memory at a time, and all
 * revoked when the list goes. A thumbnail is never kept: the device's records go into the profile's
 * export as they are.
 */
class Thumbnails {
  readonly #made = new Map<string, Promise<string | undefined>>();
  readonly #urls: string[] = [];
  readonly #read: (pageId: string) => Promise<KeptPhoto | undefined>;
  #queue: Promise<unknown> = Promise.resolve();
  #closed = false;

  constructor(read: (pageId: string) => Promise<KeptPhoto | undefined>) {
    this.#read = read;
  }

  /** The object URL of a page's thumbnail; none when its photo is not there or cannot be read. */
  of(pageId: string): Promise<string | undefined> {
    const held = this.#made.get(pageId);
    if (held !== undefined) return held;
    const made = this.#queue
      .then(async () => {
        if (this.#closed) return undefined;
        const photo = await this.#read(pageId);
        if (photo === undefined) return undefined;
        const blob = await thumbnailOf(photo.bytes);
        if (this.#closed) return undefined;
        const url = URL.createObjectURL(blob);
        this.#urls.push(url);
        return url;
      })
      .catch(() => undefined);
    this.#queue = made;
    this.#made.set(pageId, made);
    return made;
  }

  close(): void {
    this.#closed = true;
    for (const url of this.#urls.splice(0)) URL.revokeObjectURL(url);
  }
}

/**
 * A page's thumbnail: a skeleton of its size while it is made, then the photo, or a
 * blank sheet where the photo cannot be shown. It is decorative, as the row's name is when and how
 * many: its skeleton says no "Loading" inside the row's name either.
 */
function Thumbnail({
  pageId,
  thumbnails,
}: {
  readonly pageId: string;
  readonly thumbnails: Thumbnails | undefined;
}) {
  // None while it is made; null where it cannot be shown.
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (thumbnails === undefined) return;
    let current = true;
    void thumbnails.of(pageId).then((made) => {
      if (current) setUrl(made ?? null);
    });
    return () => {
      current = false;
    };
  }, [thumbnails, pageId]);
  return (
    <span className="nt-pages-thumb">
      {url === undefined ? (
        <Sk width="100%" height="100%" radius="0.375rem" />
      ) : url === null ? (
        <span className="nt-pages-blank">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <img src={url} alt="" onError={() => setUrl(null)} />
      )}
    </span>
  );
}

export function YourPages({
  profileId,
  device,
}: {
  readonly profileId: string;
  readonly device: Device;
}) {
  const paper = usePaper();
  const { language, words } = useLanguage();
  const [pages, setPages] = useState<readonly PageSummary[]>([]);
  const [thumbnails, setThumbnails] = useState<Thumbnails | undefined>(undefined);
  // A page that did not open: the device keeps it no more.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let current = true;
    void (async () => (await openProfile(device, profileId))?.pages() ?? [])().then(
      (found) => {
        if (current) setPages(found);
      },
      () => {},
    );
    const made = new Thumbnails(async (pageId) =>
      (await openProfile(device, profileId))?.photo(pageId),
    );
    setThumbnails(made);
    return () => {
      current = false;
      made.close();
    };
  }, [device, profileId]);
  if (paper === undefined) return null;
  const when = dateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
  const label = words.text("paper.pages");
  return (
    <PopOver
      label={label}
      className="nt-paper-pages"
      popClassName="nt-pop-pages"
      caption={
        <>
          <Icon value="history" />
          {words.text("paper.history")}
        </>
      }
      onClosed={() => setGone(false)}
    >
      {(close) => (
        <>
          <div className="nt-pages-head">
            <h2>{label}</h2>
            <span>{words.text("paper.pages-here")}</span>
          </div>
          {pages.length === 0 && !gone ? <p>{words.text("paper.pages-none")}</p> : null}
          <ol className="nt-pages">
            {pages.map((page) => {
              const taken = when.format(page.takenAt);
              const tasks = words.text("paper.page-tasks", { count: page.tasks });
              return (
                <li key={page.pageId}>
                  <button
                    type="button"
                    className="nt-pages-row"
                    // The two lines as one name, with the dot between them they leave out.
                    aria-label={words.text("paper.page", { when: taken, tasks })}
                    onClick={() =>
                      void paper.open(page.pageId).then((opened) => {
                        if (!opened) {
                          setPages((now) => now.filter((each) => each.pageId !== page.pageId));
                          return setGone(true);
                        }
                        close();
                        navigate(PAPER);
                      })
                    }
                  >
                    <Thumbnail pageId={page.pageId} thumbnails={thumbnails} />
                    <span className="nt-pages-words">
                      <span className="nt-pages-when">{taken}</span>
                      <span className="nt-pages-count">{tasks}</span>
                    </span>
                    <span className="nt-pages-more">
                      <Icon value="more" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {gone ? (
            <p role="alert" className="nt-error">
              {words.text("paper.page-gone")}
            </p>
          ) : null}
          <p className="nt-pages-kept">
            <span className="nt-pages-lock">
              <Icon value="state-locked" />
            </span>
            {words.text("paper.pages-kept", { count: MAX_PAGES })}
          </p>
        </>
      )}
    </PopOver>
  );
}
