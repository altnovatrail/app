// The shell of the app: the home of the learner chosen is Home (R62), `#/subjects` the catalog of
// the server, `#/task` the task screen of the attempt they have open (R20), `#/lesson` the player
// of the lesson run they chose (R23), `#/skill-map/<module>` a module's skill map, the second way
// in (R34), and `#/paper` the camera and the tasks of a page photographed (R71). The attempt open
// and the lesson runs open are the learner's in memory, from what GetAccount named. The bar and the
// screens are in the language of the learner's profile, else the device's; the buttons of the
// device's language are on the sign-in screen and in the section for adults (R17). Home, Subjects
// and the skill map stand in the mockup's frame (R79): the row of places, or the phone's tab bar,
// and at the top right the tutor, the notifications and the profile's menu; the lesson and the task
// have the pill in their own top bar (R64, R65), as the page photographed has its own (R71), and
// any other screen of a learner the bar that names them and switches, opens the section for adults
// or signs out (R29). The voicing of the screens is the learner's profile's and this device's, and
// speech stops when the screen changes (R07, R36). With no learner — a screen's own test — the home
// is a bare screen.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type Learner, useLearner } from "../account/AccountGate.tsx";
import { useStorage } from "../boot/Boot.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LearnerLanguage } from "../i18n/LearnerLanguage.tsx";
import { LessonProvider } from "../lesson/LessonContext.tsx";
import { LessonRoute } from "../lesson/LessonRoute.tsx";
import { PaperProvider } from "../paper/PaperContext.tsx";
import { PaperScreen } from "../paper/PaperScreen.tsx";
import { SkillMapRoute } from "../skills/SkillMapScreen.tsx";
import { MySubjects } from "../subjects/MySubjects.tsx";
import { SubjectsPage } from "../subjects/SubjectsPage.tsx";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { TaskRoute } from "../task/TaskRoute.tsx";
import { VoicingProvider } from "../voice/VoicingContext.tsx";
import type { Route } from "./router.ts";
import {
  ADULTS,
  HOME,
  LESSON,
  navigate,
  PAPER,
  SKILL_MAP,
  SUBJECTS,
  TASK,
  useRoute,
} from "./router.ts";
import { Screen } from "./Screen.tsx";
import { type Place, ShellBar } from "./Shell.tsx";

/** The place of the row of places a screen stands in; none for a screen outside the frame. */
function placeOf(screen: string): Place | undefined {
  if (screen === HOME.screen) return "home";
  if (screen === SUBJECTS.screen || screen === SKILL_MAP.screen) return "subjects";
  return undefined;
}

/**
 * Who is learning, and the buttons to switch the learner, to open the section for adults or to sign
 * out, by the route's screen: none in the frame of Home, Subjects and the skill map, whose top right
 * holds the profile's menu (R79), none in a lesson and on the task screen, whose bars hold the pill
 * themselves (R64, R65), none on the screens of a task from paper (R71), and the bar of buttons on
 * any other; none with no learner.
 */
export function LearnerBar() {
  const chosen = useLearner();
  const { screen } = useRoute();
  const { words } = useLanguage();
  if (
    chosen === undefined ||
    placeOf(screen) !== undefined ||
    screen === LESSON.screen ||
    screen === TASK.screen ||
    screen === PAPER.screen
  ) {
    return null;
  }
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

/**
 * The screen of the route, for the learner chosen: in the frame of the row of places where it is
 * one of its places, inside the learner's attempt, lessons and pages, which its tutor's panel leads
 * to.
 */
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
  const place = placeOf(route.screen);
  return (
    <AttemptProvider learner={learner}>
      <LessonProvider learner={learner}>
        <PaperProvider profileId={learner.profileId} device={device}>
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
          ) : route.screen === PAPER.screen ? (
            <PaperScreen profileId={learner.profileId} adult={adult} />
          ) : (
            <div className="nt-shell">
              <ShellBar place={place ?? "home"} />
              {route.screen === SKILL_MAP.screen ? (
                <SkillMapRoute route={route} profileId={learner.profileId} device={device} />
              ) : route.screen === SUBJECTS.screen ? (
                <SubjectsPage profileId={learner.profileId} />
              ) : (
                <MySubjects profileId={learner.profileId} device={device} />
              )}
            </div>
          )}
        </PaperProvider>
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
        <LearnerScreens key={chosen.learner.profileId} route={route} chosen={chosen} />
      </div>
    </LearnerLanguage>
  );
}
