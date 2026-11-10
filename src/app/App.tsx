// The shell of the app. Its screens come with the tasks of epic E2 (RUN.md); for now there is the
// home screen alone, with the heading every screen has (section 3.9 of docs/architecture.md).
import { useRoute } from "./router.ts";

export function App() {
  const route = useRoute();
  return (
    <main>
      <h1>NovaTrail</h1>
      <p data-screen={route.screen} />
    </main>
  );
}
