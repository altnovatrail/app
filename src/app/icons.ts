// Written by scripts/icons.ts — `just icons` — from @iconify-json/material-symbols 1.2.98:
// Material Symbols by Google, under the Apache License 2.0 (R15 in docs/decisions.md; R78 spec).
// ci-lint fails unless it is what the script writes, so it is never edited by hand.

/** The icons of the app's buttons, by their names in the set, as the app draws them. */
export const ICONS = {
  "arrow-circle-right-outline-rounded": {
    viewBox: "0 0 24 24",
    paths: [
      "m12.2 13l-.9.9q-.275.275-.275.7t.275.7t.7.275t.7-.275l2.6-2.6q.3-.3.3-.7t-.3-.7l-2.6-2.6q-.275-.275-.7-.275t-.7.275t-.275.7t.275.7l.9.9H9q-.425 0-.712.288T8 12t.288.713T9 13zm-.2 9q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8",
    ],
  },
} as const;

/** The name of an icon of the app. */
export type IconName = keyof typeof ICONS;

/**
 * Each value of the app, by its key: the icon in outline, the one its button shows while chosen —
 * the same for a value without a fill — and whether the icon is mirrored in a line that runs right
 * to left (architecture 6 spec).
 */
export const VALUES = {
  continue: {
    outline: "arrow-circle-right-outline-rounded",
    filled: "arrow-circle-right-outline-rounded",
    mirrored: true,
  },
} as const satisfies Record<string, { outline: IconName; filled: IconName; mirrored: boolean }>;

/** A value of the app. */
export type IconValue = keyof typeof VALUES;
