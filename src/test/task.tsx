// The task screen for the tests of the theme: a task answered by options, all chosen, and Check on a
// pause, as TaskScreen shows it.
import "@altnovatrail/canvas";
import { NO_VERDICTS } from "../task/attempt.ts";
import { initialState } from "../task/steps.ts";
import { TaskScreen } from "../task/TaskScreen.tsx";

export function blinkingCheck() {
  return (
    <TaskScreen
      task={{
        id: "pick",
        statement: [{ text: "Pick one." }],
        canvas: { kind: "handwriting_sheet" },
        items: [{ answer_slots: [{ binding: "choice", options: ["4", "5"] }] }],
      }}
      manifest={undefined}
      steps={[]}
      catalog={undefined}
      state={{ ...initialState("self"), choices: { "1.1": "5" } }}
      mode="self"
      verdicts={NO_VERDICTS}
      filled={null}
      history={[]}
      media={() => Promise.reject(new Error("no file in this test"))}
      notSaved={false}
      pending={false}
      blink
      onHistoryChange={() => {}}
      onMode={() => {}}
      onGoTo={() => {}}
      onTick={() => {}}
      onDone={() => {}}
      onChoose={() => {}}
      onCheck={() => {}}
      onHint={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
    />
  );
}
