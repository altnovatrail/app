// What a report of a problem with the tutor's words names (R123 in spec, its amendment of
// 2026-11-10; section 15 of the text of the contracts; R33 in docs/decisions.md): which reply of
// the tutor the words came by and beside a rung its number, the words as the screen shows them,
// one word of the closed set, and the person's text. No DOM.
import {
  ProblemKind,
  type ReportProblemRequestSchema,
  TutorReply,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { MessageInitShape } from "@bufbuild/protobuf";

/** The tutor's words on the screen, and the reply that brought them. */
export interface Said {
  readonly text: string;
  /**
   * The answer the words came by: a rung — GetRungWords, or the hint again after a wrong answer —,
   * "explain differently", or the correct answer.
   */
  readonly reply: TutorReply;
  /** Beside a rung and "explain differently", the rung, from 1 to 3; 0 beside a correct answer. */
  readonly rung: number;
}

/** The six kinds of a problem, in the order the form gives them, each with its word's key. */
export const KINDS = [
  [ProblemKind.WRONG, "report.kind-wrong"],
  [ProblemKind.UNCLEAR, "report.kind-unclear"],
  [ProblemKind.NOT_FOR_AGE, "report.kind-not-for-age"],
  [ProblemKind.HARMFUL, "report.kind-harmful"],
  [ProblemKind.PERSONAL, "report.kind-personal"],
  [ProblemKind.OTHER, "report.kind-other"],
] as const;

/**
 * The longest text of a report: 1000 Unicode code points in the contract. A field's `maxLength`
 * counts UTF-16 code units, of which a text has at least as many as code points, so what the field
 * lets through always fits.
 */
export const TEXT_LIMIT = 1000;

/** Why a report cannot go as the form holds it, by the key of its words; none when it can. */
export function unsendable(
  kind: ProblemKind | undefined,
  text: string,
): "report.no-kind" | "report.no-text" | undefined {
  if (kind === undefined) return "report.no-kind";
  // "Something else" is the one the text says (ProblemKind in the contract).
  if (kind === ProblemKind.OTHER && text.trim() === "") return "report.no-text";
  return undefined;
}

/** The request of a report: the rung only beside a rung's words and "explain differently". */
export function reportRequest(fields: {
  readonly profileId: string;
  readonly attemptId: string;
  readonly key: string;
  readonly said: Said;
  readonly kind: ProblemKind;
  readonly text: string;
}): MessageInitShape<typeof ReportProblemRequestSchema> {
  const { said } = fields;
  return {
    profileId: fields.profileId,
    attemptId: fields.attemptId,
    idempotencyKey: fields.key,
    reply: said.reply,
    ...(said.reply === TutorReply.RUNG || said.reply === TutorReply.EXPLAINED_DIFFERENTLY
      ? { rung: said.rung }
      : {}),
    words: said.text,
    kind: fields.kind,
    text: fields.text.trim(),
  };
}
