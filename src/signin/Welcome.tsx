// The frame of the way in before the account (the mockup's `signin`, `invite` and `agree`; R11,
// R61): from 600 CSS px the art at the left — the name, a trail of subjects to the spark, and the
// line of what NovaTrail is — and the step's column in the middle of the rest, what the step puts
// in the corner at its top right; below 600 the art a band above the first step alone, and the
// corner below the column. At the foot, the way to the legal pages (R31).
import type { ReactNode } from "react";
import { Brand, Spark } from "../app/Brand.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The subjects along the art's trail, and where each stands in its box of 600 × 834. */
const TRAIL = [
  { text: "x²", x: 96, y: 700 },
  { text: "Aa", x: 236, y: 540 },
  { text: "{ }", x: 392, y: 452 },
  { text: "π", x: 316, y: 306 },
] as const;

/** The art: drawn, but for the name and the line of what NovaTrail is. */
function Art({ first }: { readonly first: boolean }) {
  const { words } = useLanguage();
  return (
    <div className={first ? "nt-art" : "nt-art nt-art-later"}>
      <Brand className="nt-art-brand" dot />
      <svg className="nt-art-trail" aria-hidden="true" focusable="false" viewBox="0 0 600 834">
        <path d="M40 790 C70 760 80 735 96 700 C130 640 170 580 236 540 C290 505 370 500 392 452 C410 410 300 360 316 306 C330 250 400 190 470 150 C500 132 540 118 600 108" />
      </svg>
      {TRAIL.map(({ text, x, y }) => (
        <span
          key={text}
          className="nt-art-stop"
          aria-hidden="true"
          style={{ left: `${(x / 600) * 100}%`, top: `${(y / 834) * 100}%` }}
        >
          {text}
        </span>
      ))}
      <span className="nt-art-star" aria-hidden="true">
        <Spark />
      </span>
      <div className="nt-art-tag">
        <p className="nt-art-title">{words.text("signin.tagline")}</p>
        <p>{words.text("signin.tagline-line")}</p>
      </div>
    </div>
  );
}

export interface WelcomeScreenProps {
  readonly title: string;
  /** The first step, the sign-in: the art is a band above it on a phone too. */
  readonly first?: boolean;
  /** What stands above the heading: the mark, or the way back to the step before. */
  readonly lead?: ReactNode;
  /** What stands in the top right corner: the languages of the sign-in. */
  readonly corner?: ReactNode;
  /** Opens the legal pages. */
  readonly onLegal: () => void;
  readonly children: ReactNode;
}

export function WelcomeScreen({
  title,
  first = false,
  lead,
  corner,
  onLegal,
  children,
}: WelcomeScreenProps) {
  const { words } = useLanguage();
  return (
    <Screen
      title={title}
      layout="welcome"
      before={<Art first={first} />}
      lead={lead}
      after={
        <>
          {corner === undefined ? null : <div className="nt-welcome-corner">{corner}</div>}
          <div className="nt-welcome-foot">
            <button type="button" className="nt-link nt-quiet" onClick={onLegal}>
              {words.text("legal.title")}
            </button>
          </div>
        </>
      }
    >
      {children}
    </Screen>
  );
}
