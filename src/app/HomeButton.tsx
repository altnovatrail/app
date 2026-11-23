// The way back to Home from a learner's screen that is not the home itself: a
// secondary button with its words on it, the one element every such screen shows — at the top,
// under the heading, as the skill map has it, or beside the screen's last buttons.
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { HOME, navigate } from "./router.ts";

interface HomeProps {
  /** What the screen gives for leaving; home by default. */
  readonly onPress?: () => void;
  /**
   * A request of the screen is under way, whose answer the learner would not see: the button is
   * `aria-disabled` and does nothing, as "Try it again" does, and keeps the focus.
   */
  readonly pending?: boolean;
}

/** "Back to Home", which goes home, or does what the screen gives for leaving. */
export function HomeButton({ onPress = () => navigate(HOME), pending = false }: HomeProps) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      className="nt-secondary"
      {...(pending ? { "aria-disabled": true } : {})}
      onClick={() => {
        if (!pending) onPress();
      }}
    >
      {words.text("task.home")}
    </button>
  );
}

/** The button alone in its row. */
export function HomeWay(props: HomeProps) {
  return (
    <div className="nt-buttons">
      <HomeButton {...props} />
    </div>
  );
}
