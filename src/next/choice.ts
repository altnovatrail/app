// What an engine's choice gives (section 3.4 of docs/architecture.md; R24 in docs/decisions.md;
// `EngineChoice` in the contract): a lesson, a task outside a lesson, or nothing — and a kind this
// build does not know is nothing too. No DOM.
import {
  ChoiceKind,
  type EngineChoice,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";

/** What a choice gives, as the screen offers it. */
export type Given = "lesson" | "task" | "nothing";

/** What a choice gives; a lesson or a task without its choice's ID is nothing to begin. */
export function givenOf(choice: EngineChoice): Given {
  if (choice.choiceId === "") return "nothing";
  if (choice.kind === ChoiceKind.LESSON) return "lesson";
  if (choice.kind === ChoiceKind.TASK) return "task";
  return "nothing";
}

/** The words of the button to a choice, by what it gives; none for nothing. */
export const NEXT_KEYS = {
  lesson: "next.lesson",
  task: "next.task",
} as const;
