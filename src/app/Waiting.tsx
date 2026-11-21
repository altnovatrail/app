// What stands while the next screen is read (the mockup's `wait` and `wait-home`): the ground of
// the screen to come at once — the sky of the way in and of "Who is learning?", or the page of the
// learner's screens —, never a white page, and the spark of the name pulsing in its middle once the
// wait passes 0.3 s, so that a quick read shows no flicker. A screen reader hears "Loading" then;
// under "Reduce motion" the spark stands still.
import { useEffect, useState } from "react";
import { Stars } from "../account/Stars.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Spark } from "./Brand.tsx";

/** How long a wait shows its ground alone, ms. */
export const WAIT_MS = 300;

export function Waiting({ ground }: { readonly ground: "sky" | "page" }) {
  const { words } = useLanguage();
  const [long, setLong] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLong(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main className={`nt-wait nt-wait-${ground}`} aria-busy="true">
      {ground === "sky" ? <Stars /> : null}
      <p role="status" className="nt-wait-status">
        {long ? (
          <>
            <span className="nt-wait-spark">
              <span className="nt-wait-mark">
                <Spark />
              </span>
            </span>
            <span className="nt-hidden-label">{words.text("wait.label")}</span>
          </>
        ) : null}
      </p>
    </main>
  );
}
