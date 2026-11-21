// The choice of the learner, as the mockup's `who` (R08, R61; R148 spec): on the sign-in's sky with
// stars of its own, each profile a dark card — its avatar and pseudonym, whose profile it is, and
// "Start" — the owner's with no PIN while the account has no child; "Add a learner" a card of
// glass, shown but not open, with the line why, until a child's profile comes with a parent's
// consent. Above, the name, and the sign-out a pill of glass; the section for adults opens from the
// profile's menu once a learner is chosen (R29). On the first sign-in it asks the browser to keep
// the site's data, with no line of its own: the adult who just signed in is the one who sees
// Firefox's prompt (R04).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useEffect, useId } from "react";
import { Brand } from "../app/Brand.tsx";
import { Icon } from "../app/Icon.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { siteStorage } from "../storage/browser.ts";
import { Avatar } from "./Avatar.tsx";

/** The stars of the mockup's `who`, on its iPad of 1180 × 820: x, y, the diameter and the opacity. */
const STARS: readonly (readonly [number, number, number, number])[] = [
  [1111, 215, 3.6, 0.78],
  [715, 77, 1.8, 0.76],
  [947, 658, 1.3, 0.65],
  [950, 91, 3.3, 0.72],
  [75, 619, 3.7, 0.58],
  [40, 655, 3.3, 0.86],
  [999, 276, 3.8, 0.58],
  [659, 373, 1.1, 0.85],
  [990, 794, 3.4, 0.66],
  [880, 518, 1.3, 0.74],
  [948, 605, 2.1, 0.76],
  [1138, 60, 3.8, 0.43],
  [212, 563, 3.6, 0.42],
  [562, 303, 2.6, 0.72],
  [104, 480, 3.4, 0.58],
  [895, 158, 3.8, 0.61],
  [259, 732, 1.7, 0.52],
  [928, 281, 1.2, 0.31],
  [269, 568, 3.9, 0.5],
  [802, 120, 1.3, 0.57],
  [950, 730, 2.2, 0.61],
  [234, 782, 2.9, 0.51],
  [668, 494, 3.5, 0.66],
  [929, 52, 2.5, 0.7],
  [411, 545, 2.8, 0.43],
  [619, 79, 1.2, 0.6],
  [486, 275, 4, 0.36],
  [418, 365, 2.6, 0.67],
  [275, 142, 2.5, 0.78],
  [381, 386, 2.7, 0.6],
  [1017, 748, 1.3, 0.41],
  [395, 431, 3.4, 0.4],
  [233, 130, 3.6, 0.61],
  [686, 680, 3.8, 0.66],
  [600, 692, 2.8, 0.47],
  [804, 776, 2.8, 0.81],
  [187, 668, 3.3, 0.63],
  [509, 671, 2.7, 0.78],
  [572, 548, 2.1, 0.38],
  [279, 460, 1.6, 0.7],
  [882, 115, 2.3, 0.54],
  [298, 715, 3.7, 0.33],
  [582, 561, 3.8, 0.69],
  [200, 291, 3.3, 0.74],
  [742, 263, 3.5, 0.46],
  [716, 719, 2.9, 0.39],
  [362, 186, 2, 0.59],
  [383, 458, 3.6, 0.57],
  [301, 679, 3.9, 0.8],
  [989, 306, 3.2, 0.48],
  [1123, 287, 2.8, 0.45],
  [98, 189, 2.8, 0.52],
  [560, 398, 2.9, 0.82],
  [300, 256, 3.3, 0.51],
  [865, 515, 1.6, 0.55],
  [975, 208, 3.2, 0.8],
  [954, 114, 1, 0.55],
  [1084, 645, 2.3, 0.69],
  [715, 244, 3, 0.82],
  [427, 365, 3.9, 0.37],
  [373, 324, 3.8, 0.75],
  [540, 251, 1.5, 0.69],
  [617, 757, 2.1, 0.36],
  [634, 59, 2.3, 0.51],
  [69, 737, 3.4, 0.8],
  [1146, 276, 3.5, 0.33],
  [346, 357, 2.6, 0.39],
  [62, 688, 1.9, 0.36],
  [492, 190, 1.1, 0.68],
  [269, 205, 3.8, 0.78],
];

/** The sky's stars, a star of 3 or more aglow, drawn and hidden from assistive technology. */
function Stars() {
  return (
    <svg
      className="nt-who-stars"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1180 820"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <filter id="nt-who-glow" x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {STARS.map(([x, y, d, a]) => (
        <g key={`${x} ${y}`} fill={`rgba(255, 255, 255, ${a})`}>
          {d >= 3 ? <circle cx={x} cy={y} r={d} filter="url(#nt-who-glow)" /> : null}
          <circle cx={x} cy={y} r={d / 2} />
        </g>
      ))}
    </svg>
  );
}

export interface ChooseScreenProps {
  readonly profiles: readonly Profile[];
  readonly first: boolean;
  readonly onChoose: (profile: Profile) => void;
  readonly onSignOut: () => void;
}

export function ChooseScreen({ profiles, first, onChoose, onSignOut }: ChooseScreenProps) {
  const { words } = useLanguage();
  const id = useId();
  useEffect(() => {
    if (first) void siteStorage.persist();
  }, [first]);
  return (
    <Screen
      title={words.text("choose.title")}
      layout="who"
      before={
        <>
          <Stars />
          <div className="nt-profiles-top">
            <Brand className="nt-brand" />
            <button type="button" className="nt-who-out" onClick={onSignOut}>
              <Icon value="sign-out" />
              {words.text("signout.button")}
            </button>
          </div>
        </>
      }
    >
      <p className="nt-lead">{words.text("choose.intro")}</p>
      <ul className="nt-learners">
        {profiles.map((profile) => (
          <li key={profile.profileId}>
            {/* Named by the pseudonym alone, whose profile it is its description; the button covers
                the whole card, and "Start" is the card's look, not a second button. */}
            <button
              type="button"
              className="nt-learner"
              aria-describedby={`${id}-${profile.profileId}`}
              onClick={() => onChoose(profile)}
            >
              <Avatar code={profile.avatar} size="large" />
              <span className="nt-learner-name">{profile.pseudonym}</span>
            </button>
            <p id={`${id}-${profile.profileId}`} className="nt-learner-line">
              {words.text(profile.owner ? "choose.owner" : "choose.learner")}
            </p>
            <span className="nt-learner-start" aria-hidden="true">
              {words.text("choose.start")}
            </span>
          </li>
        ))}
        <li className="nt-learner-add">
          <button type="button" className="nt-learner" disabled aria-describedby={`${id}-add`}>
            <span className="nt-avatar nt-avatar-large nt-avatar-add">
              <Icon value="add" />
            </span>
            <span className="nt-learner-name">{words.text("choose.add")}</span>
          </button>
          <p id={`${id}-add`} className="nt-learner-line">
            {words.text("choose.add-why")}
          </p>
        </li>
      </ul>
    </Screen>
  );
}
