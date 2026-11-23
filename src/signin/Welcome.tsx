// The frame of the way in before the account (the mockup's `signin`, `invite` and `agree`): the
// sky over the whole window — the app's name at its top, the trail of maths to the spark,
// and what the step puts in the corner at its top right —, and the step on a dark card. From 600
// CSS px the trail and the card stand where the mockup's iPad has them, in a middle of 1194 × 834,
// on a computer too; below 600 the trail drawn small above the card of the first step alone, and
// the card of a later step right under the name. At the card's foot, the way to the legal pages.
import type { ReactNode } from "react";
import { Brand } from "../app/Brand.tsx";
import { Screen } from "../app/Screen.tsx";
import { SPARK } from "../app/spark.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The stops of the trail, each the centre of its circle in the sky's box of 600 × 834. */
const TRAIL = [
  { text: "+", x: 100, y: 745, size: 24 },
  { text: "×", x: 212, y: 732, size: 24 },
  { text: "½", x: 316, y: 695, size: 24 },
  { text: "x²", x: 404, y: 626, size: 20 },
  { text: "√x", x: 458, y: 530, size: 20 },
  { text: "π", x: 482, y: 421, size: 24 },
  { text: "∫", x: 483, y: 310, size: 24 },
] as const;

/** The stars, as the mockup's: the centre, the diameter and the opacity; a glow from 3 px. */
const STARS: readonly (readonly [number, number, number, number])[] = [
  [256.7, 410.7, 1.3, 0.45],
  [236.6, 383.6, 1.2, 0.83],
  [299, 336, 1.9, 0.77],
  [327.3, 169.3, 2.5, 0.44],
  [333.4, 210.4, 2.7, 0.59],
  [125.9, 156.9, 3.8, 0.88],
  [103, 354, 3.9, 0.41],
  [227.5, 406.5, 3, 0.47],
  [123.2, 624.2, 2.3, 0.44],
  [280.8, 295.8, 1.5, 0.76],
  [198.6, 305.6, 1.2, 0.86],
  [151.2, 573.2, 2.4, 0.44],
  [304.7, 332.7, 3.3, 0.69],
  [108.2, 243.2, 2.4, 0.35],
  [71.5, 337.5, 3, 0.69],
  [452.2, 293.2, 2.3, 0.6],
  [235.2, 550.2, 2.4, 0.56],
  [162.6, 249.6, 3.2, 0.38],
  [165.8, 514.8, 3.6, 0.88],
  [440.6, 561.6, 3.2, 0.68],
  [284, 143, 2, 0.51],
  [141.6, 328.6, 3.1, 0.74],
  [162.5, 608.5, 1, 0.52],
  [296.7, 351.7, 1.3, 0.89],
  [243.4, 567.4, 2.8, 0.58],
  [104.9, 528.9, 3.7, 0.46],
  [61.6, 208.6, 3.1, 0.72],
  [327.9, 565.9, 1.7, 0.8],
  [121.6, 149.6, 1.2, 0.31],
  [277.8, 546.8, 3.5, 0.39],
  [257.9, 156.9, 1.8, 0.59],
  [77.9, 308.9, 1.7, 0.48],
  [382.8, 198.8, 1.5, 0.3],
  [313.1, 174.1, 2.2, 0.37],
  [251.5, 337.5, 1, 0.75],
  [241, 500, 2, 0.86],
  [351.9, 450.9, 1.8, 0.52],
  [82.6, 571.6, 1.2, 0.34],
  [128.6, 282.6, 1.1, 0.66],
  [236.3, 320.3, 2.6, 0.84],
  [272.7, 341.7, 1.4, 0.84],
  [329.9, 380.9, 3.7, 0.71],
  [244.9, 615.9, 3.7, 0.55],
  [260.7, 482.7, 3.4, 0.85],
  [280.5, 626.5, 2.9, 0.8],
  [237, 170, 3.9, 0.63],
  [325.7, 327.7, 3.3, 0.77],
  [262.8, 353.8, 3.6, 0.73],
  [73.2, 316.2, 2.4, 0.89],
  [328.5, 208.5, 3, 0.4],
  [135, 395, 1.9, 0.31],
  [453.6, 387.6, 1.1, 0.53],
  [127.9, 459.9, 1.7, 0.74],
  [179.4, 585.4, 2.8, 0.54],
  [400, 220, 2, 0.55],
  [426.7, 414.7, 1.3, 0.4],
  [255.1, 256.1, 2.2, 0.61],
  [189.6, 144.6, 1.2, 0.74],
  [243.9, 408.9, 3.7, 0.36],
  [221.1, 243.1, 2.2, 0.32],
];

/** The sky's trail, its stars and the spark, drawn and hidden from assistive technology. */
function Sky({ first }: { readonly first: boolean }) {
  return (
    <svg
      className={first ? "nt-sky" : "nt-sky nt-sky-later"}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 600 834"
    >
      <defs>
        <filter id="nt-sky-glow" x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="nt-spark-glow" x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="30" />
        </filter>
        {/* The trail stops at each circle, as under the mockup's glass, which SVG cannot blur. */}
        <mask id="nt-sky-trail-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="834">
          <rect width="600" height="834" fill="white" />
          {TRAIL.map(({ text, x, y }) => (
            <circle key={text} cx={x} cy={y} r="29" fill="black" />
          ))}
        </mask>
      </defs>
      {STARS.map(([x, y, d, a]) => (
        <g key={`${x} ${y}`} opacity={a}>
          {d >= 3 ? <circle cx={x} cy={y} r={d} filter="url(#nt-sky-glow)" /> : null}
          <circle cx={x} cy={y} r={d / 2} />
        </g>
      ))}
      <path className="nt-sky-trail" d="M100 750 Q560 735 470 200" mask="url(#nt-sky-trail-cut)" />
      {TRAIL.map(({ text, x, y, size }) => (
        <g key={text} className="nt-sky-stop">
          <circle cx={x} cy={y} r="28.5" />
          <text x={x} y={y} fontSize={size}>
            {text}
          </text>
        </g>
      ))}
      <g className="nt-sky-spark">
        <circle cx="470" cy="200" r="48" opacity="0.45" filter="url(#nt-spark-glow)" />
        <circle cx="470" cy="200" r="60" opacity="0.22" />
        <circle cx="470" cy="200" r="48" />
        <path d={SPARK} transform="translate(450 180) scale(1.6667)" />
      </g>
    </svg>
  );
}

export interface WelcomeScreenProps {
  readonly title: string;
  /** The first step, the sign-in: the trail stands above its card on a phone too. */
  readonly first?: boolean;
  /** What stands above the heading: the mark, or the way back to the step before. */
  readonly lead?: ReactNode;
  /** What stands in the top right corner: the language of the sign-in. */
  readonly corner?: ReactNode;
  /** Opens the legal pages, or a legal text's sheet. */
  readonly onLegal: () => void;
  /** What stands over the screen: a legal text's sheet. */
  readonly over?: ReactNode;
  readonly children: ReactNode;
}

export function WelcomeScreen({
  title,
  first = false,
  lead,
  corner,
  onLegal,
  over,
  children,
}: WelcomeScreenProps) {
  const { words } = useLanguage();
  return (
    <Screen
      title={title}
      layout="welcome"
      before={
        <>
          <Sky first={first} />
          <Brand className="nt-welcome-brand" dot />
        </>
      }
      lead={lead}
      after={corner === undefined ? undefined : <div className="nt-welcome-corner">{corner}</div>}
    >
      {children}
      <div className="nt-welcome-foot">
        <button type="button" className="nt-link nt-quiet" onClick={onLegal}>
          {words.text("legal.title")}
        </button>
      </div>
      {over}
    </Screen>
  );
}
