// The shell of the app. Its screens come with the tasks of epic E2 (RUN.md); for now there is the
// home screen of the learner chosen, below the bar that names them and switches or signs out
// (sections 3.2 and 3.6 of docs/architecture.md). The buttons of the device's language are on the
// sign-in screen (section 3.8).
import { useLearner } from "../account/AccountGate.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useRoute } from "./router.ts";
import { Screen } from "./Screen.tsx";

/** Who is learning, and the buttons to switch the learner or sign out. */
function LearnerBar() {
  const chosen = useLearner();
  const { words } = useLanguage();
  if (chosen === undefined) return null;
  return (
    <header className="nt-bar">
      <p>{chosen.learner.pseudonym}</p>
      <button type="button" className="nt-secondary" onClick={chosen.switchLearner}>
        {words.text("learner.switch")}
      </button>
      <button type="button" className="nt-secondary" onClick={chosen.signOut}>
        {words.text("signout.button")}
      </button>
    </header>
  );
}

export function App() {
  const route = useRoute();
  const { words } = useLanguage();
  return (
    <>
      <LearnerBar />
      <Screen title={words.text("home.title")}>
        <p data-screen={route.screen} />
      </Screen>
    </>
  );
}
