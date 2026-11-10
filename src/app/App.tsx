// The shell of the app. Its screens come with the tasks of epic E2 (RUN.md); for now there is the
// home screen alone, the one screen before sign-in, with the buttons of the device's language until
// the sign-in screen of T22 takes them (section 3.8 of docs/architecture.md).
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useRoute } from "./router.ts";
import { Screen } from "./Screen.tsx";

export function App() {
  const route = useRoute();
  const { words } = useLanguage();
  return (
    <Screen title={words.text("home.title")}>
      <LanguageButtons />
      <p data-screen={route.screen} />
    </Screen>
  );
}
