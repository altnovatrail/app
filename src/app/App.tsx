// The shell of the app. Its screens come with the tasks of epic E2 (RUN.md): the home of the learner
// chosen is "My subjects" (T23), and `#/task` the task screen of the attempt they have open (T24),
// below the bar that names them and switches or signs out (sections 3.2, 3.3, 3.6 and 3.10 of
// docs/architecture.md). The attempt open is the learner's in memory, from the open attempt
// GetAccount named outside a lesson. The buttons of the device's language are on the sign-in screen
// (section 3.8). With no learner — a screen's own test — the home is a bare screen.
import { useLearner } from "../account/AccountGate.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { MySubjects } from "../subjects/MySubjects.tsx";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { TaskRoute } from "../task/TaskRoute.tsx";
import { useRoute } from "./router.ts";
import { Screen } from "./Screen.tsx";

/** Who is learning, and the buttons to switch the learner or sign out; none with no learner. */
export function LearnerBar() {
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
  const chosen = useLearner();
  const { words } = useLanguage();
  return (
    <>
      <LearnerBar />
      <div data-screen={route.screen}>
        {chosen === undefined ? (
          <Screen title={words.text("home.title")} />
        ) : (
          <AttemptProvider key={chosen.learner.profileId} learner={chosen.learner}>
            {route.screen === "task" ? (
              <TaskRoute
                profileId={chosen.learner.profileId}
                defaultMode={chosen.learner.defaultMode}
              />
            ) : (
              <MySubjects profileId={chosen.learner.profileId} />
            )}
          </AttemptProvider>
        )}
      </div>
    </>
  );
}
