// "Your pages" on the card "A task from my paper" (R77), as the mockup's `home-pages`: the profile's
// pages from paper this device keeps, the newest first, each with when it was taken and how many
// tasks it began, behind a small button that opens a pop-over (R59). A page opens on the screen of
// solving with its tasks and their work. The button stands while the device keeps no page too, as
// the mockup's: its pop-over says there is none yet.
import { useEffect, useState } from "react";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { navigate, PAPER } from "../app/router.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Device } from "../storage/device.ts";
import { openProfile, type PageSummary } from "../storage/profile.ts";
import { usePaper } from "./PaperContext.tsx";

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
    return () => {
      current = false;
    };
  }, [device, profileId]);
  if (paper === undefined) return null;
  const when = dateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
  const label = words.text("paper.pages");
  return (
    <PopOver
      label={label}
      className="nt-paper-pages"
      popClassName="nt-pop-tasks"
      caption={
        <>
          <Icon value="photos" />
          {label}
        </>
      }
      onClosed={() => setGone(false)}
    >
      {(close) => (
        <>
          <h2 className="nt-pop-title">{words.text("paper.pages-title")}</h2>
          {pages.length === 0 && !gone ? <p>{words.text("paper.pages-none")}</p> : null}
          <ol className="nt-tasks">
            {pages.map((page) => (
              <li key={page.pageId}>
                <button
                  type="button"
                  className="nt-tasks-row"
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
                  {words.text("paper.page", {
                    when: when.format(page.takenAt),
                    tasks: words.text("paper.page-tasks", { count: page.tasks }),
                  })}
                </button>
              </li>
            ))}
          </ol>
          {gone ? (
            <p role="alert" className="nt-error">
              {words.text("paper.page-gone")}
            </p>
          ) : null}
          <p className="nt-hint">{words.text("paper.pages-kept")}</p>
        </>
      )}
    </PopOver>
  );
}
