// A button that shows its icon alone: only the buttons of spec's closed list, each
// with its caption as its accessible name and a tooltip of the same words (Tooltip.tsx).
import { type ComponentProps, type FocusEvent, type Ref, useCallback } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Key } from "../i18n/words.ts";
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";
import { useTooltip } from "./Tooltip.tsx";

/**
 * The closed list: each button that shows no caption, its icon — none for the grabber,
 * which draws a bar — and the caption that names it. A button joins the list only once spec's
 * closed list holds it.
 */
export const CAPTIONLESS = {
  back: { icon: "back", word: "icon.back" },
  close: { icon: "close", word: "common.close" },
  "previous-task": { icon: "previous-task", word: "icon.previous-task" },
  "next-task": { icon: "next-task", word: "icon.next-task" },
  "read-aloud": { icon: "read-aloud", word: "voice.read" },
  voicing: { icon: "voicing", word: "voice.toggle" },
  help: { icon: "help", word: "icon.help" },
  tutor: { icon: "tutor", word: "icon.tutor" },
  // The grabber of the tutor's sheet on a phone, 88 × 44, named by what it does next.
  "full-screen": { icon: undefined, word: "icon.full-screen" },
  "half-screen": { icon: undefined, word: "icon.half-screen" },
  // The buttons of a task from paper: the camera's shutter and its way to the photos, and the
  // cross and the corner of a frame drawn by hand.
  "take-photo": { icon: "camera", word: "icon.take-photo" },
  "choose-photos": { icon: "photos", word: "icon.choose-photos" },
  "remove-frame": { icon: "close", word: "icon.remove-frame" },
  "resize-frame": { icon: "resize", word: "icon.resize-frame" },
  // At the top right of Home, Subjects and the skill map: the notifications, a bell.
  notifications: { icon: "notifications", word: "bell.title" },
  // Under the field of a request on the page to pick from: the microphone, off until voice
  // comes, and Send.
  "ask-voice": { icon: "microphone", word: "paper.ask-voice" },
  "ask-send": { icon: "send", word: "paper.ask-send" },
  // On a module's card on Home: its skill map, described by the module's title.
  "skill-map": { icon: "skill-map", word: "skillmap.title" },
} as const satisfies Record<string, { icon: IconValue | undefined; word: Key }>;

/** A button of the closed list. */
export type Captionless = keyof typeof CAPTIONLESS;

/**
 * The captions a button of the list takes in place of its own, each for its button alone, where they
 * name where it goes: back in a lesson is "Leave the lesson", as the mockup's, back from a
 * task "Back to Home", the one way home, the section for adults' back and
 * close "Back to the section" and "Close the section", and a legal page's back "Back to the
 * list".
 */
export const INSTEAD = {
  "lesson.leave": "back",
  "task.home": "back",
  "adults.back": "back",
  "adults.close": "close",
  "legal.back": "back",
} as const satisfies Partial<Record<Key, Captionless>>;

/** A caption of INSTEAD. */
export type Instead = keyof typeof INSTEAD;

/** The captions of INSTEAD that the button `V` takes. */
export type InsteadOf<V extends Captionless> = {
  [K in Instead]: (typeof INSTEAD)[K] extends V ? K : never;
}[Instead];

export interface IconButtonProps<V extends Captionless = Captionless>
  extends Omit<ComponentProps<"button">, "children" | "type" | "ref"> {
  /** Which button of the list it is: its icon and its name. */
  readonly value: V;
  /** Whether what it stands for is chosen, on or open: then its icon is the fill, where it has one. */
  readonly chosen?: boolean;
  /** The button itself, for what opens from it: a pop-over that gives the focus back to it. */
  readonly ref?: Ref<HTMLButtonElement>;
  /** Its caption in place of the list's, one of INSTEAD for this button. */
  readonly caption?: InsteadOf<V>;
}

export function IconButton<V extends Captionless>({
  value,
  chosen = false,
  caption: named,
  className,
  onFocus,
  onBlur,
  ref,
  ...button
}: IconButtonProps<V>) {
  const { words } = useLanguage();
  const { icon, word } = CAPTIONLESS[value];
  const caption = words.text((named as Instead | undefined) ?? word);
  const expanded = button["aria-expanded"] === true || button["aria-expanded"] === "true";
  const tooltip = useTooltip<HTMLButtonElement>(caption, { open: expanded });
  const { host } = tooltip;
  // The tooltip's own ref and the one given, on the same button.
  const setButton = useCallback(
    (node: HTMLButtonElement | null) => {
      host.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref != null) ref.current = node;
    },
    [ref, host],
  );

  return tooltip.wrap(
    <button
      ref={setButton}
      type="button"
      className={["nt-icon-only", icon === undefined ? "nt-grabber" : undefined, className]
        .filter(Boolean)
        .join(" ")}
      aria-label={caption}
      onFocus={(event: FocusEvent<HTMLButtonElement>) => {
        tooltip.onFocus(event);
        onFocus?.(event);
      }}
      onBlur={(event: FocusEvent<HTMLButtonElement>) => {
        tooltip.onBlur();
        onBlur?.(event);
      }}
      {...button}
    >
      {icon === undefined ? (
        <span className="nt-grabber-bar" aria-hidden="true" />
      ) : (
        <Icon value={icon} chosen={chosen} />
      )}
    </button>,
  );
}
