// The shell of the app. Its screens come with the tasks of epics E2 and E3 (RUN.md): the home of the
// learner chosen is "My subjects" (T23), `#/task` the task screen of the attempt they have open
// (T24), `#/lesson` the player of the lesson run they chose (T27), and `#/skill-map` the skill map,
// the second way in (T43; R34), below the bar that names them and switches, opens the section for
// adults or signs out (sections 3.2, 3.3, 3.4, 3.6 and 3.10 of docs/architecture.md; R29). The
// attempt open and the lesson runs open are the learner's in memory, from what GetAccount named.
// The bar and the screens are in the language of the learner's profile, else the device's; the
// buttons of the device's language are on the sign-in screen and in the section for adults
// (section 3.8). With no learner — a screen's own test — the home is a bare screen.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useLearner } from "../account/AccountGate.tsx";
import { useStorage } from "../boot/Boot.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LearnerLanguage } from "../i18n/LearnerLanguage.tsx";
import { LessonProvider } from "../lesson/LessonContext.tsx";
import { LessonRoute } from "../lesson/LessonRoute.tsx";
import { SkillMapRoute } from "../skills/SkillMapScreen.tsx";
import { MySubjects } from "../subjects/MySubjects.tsx";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { TaskRoute } from "../task/TaskRoute.tsx";
import type { Route } from "./router.ts";
import { ADULTS, navigate, SKILL_MAP, useRoute } from "./router.ts";
import { Screen } from "./Screen.tsx";

/**
 * Who is learning, and the buttons to switch the learner, to open the section for adults or to sign
 * out; none with no learner.
 */
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
      <button type="button" className="nt-secondary" onClick={() => navigate(ADULTS)}>
        {words.text("adults.title")}
      </button>
      <button type="button" className="nt-secondary" onClick={chosen.signOut}>
        {words.text("signout.button")}
      </button>
    </header>
  );
}

/** The screens of a learner chosen, by the route. */
function LearnerScreens({ route, learner }: { readonly route: Route; readonly learner: Profile }) {
  const { device } = useStorage();
  const adult = learner.ageCategory === "adult";
  return (
    <AttemptProvider learner={learner}>
      <LessonProvider learner={learner}>
        {route.screen === "task" ? (
          <TaskRoute
            profileId={learner.profileId}
            defaultMode={learner.defaultMode}
            adult={adult}
          />
        ) : route.screen === "lesson" ? (
          <LessonRoute
            profileId={learner.profileId}
            defaultMode={learner.defaultMode}
            adult={adult}
          />
        ) : route.screen === SKILL_MAP.screen ? (
          <SkillMapRoute route={route} profileId={learner.profileId} device={device} />
        ) : (
          <MySubjects profileId={learner.profileId} device={device} />
        )}
      </LessonProvider>
    </AttemptProvider>
  );
}

export function App() {
  const route = useRoute();
  const chosen = useLearner();
  const { words } = useLanguage();
  if (chosen === undefined) {
    return (
      <div data-screen={route.screen}>
        <Screen title={words.text("home.title")} />
      </div>
    );
  }
  return (
    <LearnerLanguage field={chosen.learner.interfaceLanguage}>
      <LearnerBar />
      <div data-screen={route.screen}>
        <LearnerScreens key={chosen.learner.profileId} route={route} learner={chosen.learner} />
      </div>
    </LearnerLanguage>
  );
}
