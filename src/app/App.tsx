// The shell of the app. Its screens come with the tasks of epics E2 and E3 (RUN.md): the home of the
// learner chosen is "My subjects" (T23), `#/task` the task screen of the attempt they have open
// (T24), `#/lesson` the player of the lesson run they chose (T27), and `#/skill-map` the skill map,
// the second way in (T43; R34), and `#/essays` the essays this device keeps (T47; R53), below the bar that names them and switches, opens the section for
// adults or signs out (sections 3.2, 3.3, 3.4, 3.6 and 3.10 of docs/architecture.md; R29). The
// attempt open and the lesson runs open are the learner's in memory, from what GetAccount named.
// The bar and the screens are in the language of the learner's profile, else the device's; the
// buttons of the device's language are on the sign-in screen and in the section for adults
// (section 3.8). On "My subjects" the bar is the mockup's: the profile's pill and its menu at the
// left, the adult's Help at the right (R63); the skill map has the pill in its own top bar, and the
// task, the lesson and "My essays" keep the bar of buttons until their tasks of epic E5 draw theirs.
// The voicing of the screens is the learner's profile's and this device's, and speech
// stops when the screen changes (T45; R07). With no learner — a screen's own test — the home is a
// bare screen.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type Learner, useLearner } from "../account/AccountGate.tsx";
import { useStorage } from "../boot/Boot.tsx";
import { EssaysScreen } from "../essays/EssaysScreen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LearnerLanguage } from "../i18n/LearnerLanguage.tsx";
import { LessonProvider } from "../lesson/LessonContext.tsx";
import { LessonRoute } from "../lesson/LessonRoute.tsx";
import { SkillMapRoute } from "../skills/SkillMapScreen.tsx";
import { MySubjects } from "../subjects/MySubjects.tsx";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { TaskRoute } from "../task/TaskRoute.tsx";
import { VoicingProvider } from "../voice/VoicingContext.tsx";
import { AdultHelp } from "./Help.tsx";
import { LearnerMenu } from "./LearnerMenu.tsx";
import type { Route } from "./router.ts";
import { ADULTS, ESSAYS, LESSON, navigate, SKILL_MAP, TASK, useRoute } from "./router.ts";
import { Screen } from "./Screen.tsx";

/** The top of "My subjects": the profile's pill at the left, the adult's Help at the right. */
export function HomeBar() {
  return (
    <header className="nt-home-bar">
      <LearnerMenu />
      <AdultHelp />
    </header>
  );
}

/**
 * Who is learning, and the buttons to switch the learner, to open the section for adults or to sign
 * out, by the screen: the home's bar, none on the skill map, whose top bar holds the pill, and the
 * bar of buttons on the others; none with no learner.
 */
export function LearnerBar({ screen }: { readonly screen: string }) {
  const chosen = useLearner();
  const { words } = useLanguage();
  if (chosen === undefined || screen === SKILL_MAP.screen) return null;
  if (!SHOWN_BAR.has(screen)) return <HomeBar />;
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

/** The screens that keep the bar of buttons until their tasks of epic E5; any other is home. */
const SHOWN_BAR: ReadonlySet<string> = new Set([TASK.screen, LESSON.screen, ESSAYS.screen]);

/** The screens of a learner chosen, by the route, with the voicing of the learner's profile. */
function LearnerScreens({ route, chosen }: { readonly route: Route; readonly chosen: Learner }) {
  const { device } = useStorage();
  const { learner } = chosen;
  const adult = learner.ageCategory === "adult";
  return (
    <VoicingProvider
      profile={learner}
      device={device}
      place={[route.screen, ...route.parts].join("/")}
      onSaved={chosen.onSaved}
      onFailed={chosen.onFailed}
    >
      <LearnerRoutes route={route} learner={learner} adult={adult} />
    </VoicingProvider>
  );
}

/** The screen of the route, for the learner chosen. */
function LearnerRoutes({
  route,
  learner,
  adult,
}: {
  readonly route: Route;
  readonly learner: Profile;
  readonly adult: boolean;
}) {
  const { device } = useStorage();
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
        ) : route.screen === ESSAYS.screen ? (
          <EssaysScreen profileId={learner.profileId} device={device} />
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
      <LearnerBar screen={route.screen} />
      <div data-screen={route.screen}>
        <LearnerScreens key={chosen.learner.profileId} route={route} chosen={chosen} />
      </div>
    </LearnerLanguage>
  );
}
