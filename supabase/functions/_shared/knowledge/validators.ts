/**
 * E5 Phase C — deterministic validation gates.
 *
 * Pure functions, no I/O. Every gate must pass before a candidate is even
 * eligible for the AI grounding verifier; a candidate that fails here is
 * rejected without spending a token.
 */
import { findSpan, jaccard, tokenSet, MIN_QUOTE_CHARS } from "./units.ts";
import { normalize } from "./grade.ts";

export const VALIDATOR_VERSION = "validate@1";

export type ItemType =
  | "flashcard" | "mcq" | "true_false" | "fill_blank" | "short_answer" | "numeric" | "ordering";

export type GradeMethod = "exact" | "normalized" | "set" | "numeric" | "semantic";

/** The frozen taxonomy: which grader may serve which item type. */
export const ALLOWED_GRADERS: Record<ItemType, GradeMethod[]> = {
  flashcard: ["normalized", "semantic"],
  mcq: ["exact", "normalized"],
  true_false: ["exact", "normalized"],
  fill_blank: ["normalized", "exact"],
  short_answer: ["normalized", "semantic"],
  numeric: ["numeric"],
  ordering: ["set"],
};

export interface CandidatePayload {
  item_type: string;
  prompt: string;
  answer: Record<string, unknown>;
  options?: Array<{ text: string; is_correct: boolean }> | null;
  explanation?: string | null;
  grade_method: string;
  citation: { chunk_id?: string | null; quote: string };
}

export interface GateContext {
  /** Text of the chunk the candidate cites. */
  chunkText: string;
  /** Normalised prompts of items already published for this owner. */
  existingPrompts?: string[];
}

export interface GateResult {
  decision: "pass" | "fail";
  reasonCodes: string[];
  /** Verified span, present only when the citation gate passed. */
  span?: { char_start: number; char_end: number; quote: string };
}

const MAX_PROMPT = 2000;
const DUPLICATE_THRESHOLD = 0.85;

/** Answers longer than this are essays, not retrievable items. */
const MAX_ANSWER = 600;

export function runGates(candidate: CandidatePayload, ctx: GateContext): GateResult {
  const codes: string[] = [];

  // 1. Structural
  const prompt = String(candidate.prompt ?? "").trim();
  if (prompt.length < 8 || prompt.length > MAX_PROMPT) codes.push("structure_prompt");
  const type = candidate.item_type as ItemType;
  if (!(type in ALLOWED_GRADERS)) codes.push("structure_type");

  const answerValue = candidate.answer?.value;
  const answerValues = candidate.answer?.values;
  const hasAnswer = answerValue != null || (Array.isArray(answerValues) && answerValues.length > 0);
  if (!hasAnswer) codes.push("structure_answer");
  const answerText = String(answerValue ?? (Array.isArray(answerValues) ? answerValues.join(" ") : ""));
  if (answerText.length > MAX_ANSWER) codes.push("structure_answer_length");

  // 2. Grader compatibility
  const allowed = ALLOWED_GRADERS[type] ?? [];
  if (!allowed.includes(candidate.grade_method as GradeMethod)) codes.push("grader_incompatible");

  // 3. Type-specific shape
  if (type === "mcq") {
    const opts = candidate.options ?? [];
    const correct = opts.filter((o) => o?.is_correct).length;
    if (opts.length < 3 || opts.length > 6) codes.push("mcq_option_count");
    if (correct !== 1) codes.push("mcq_correct_count");
    const texts = opts.map((o) => normalize(String(o?.text ?? "")));
    if (new Set(texts).size !== texts.length) codes.push("mcq_duplicate_options");
    const answerNorm = normalize(answerText);
    if (answerNorm && !texts.includes(answerNorm)) codes.push("mcq_answer_not_an_option");
  }
  if (type === "true_false") {
    if (!["true", "false"].includes(normalize(answerText))) codes.push("true_false_answer");
  }
  if (type === "numeric") {
    if (!Number.isFinite(Number(answerValue))) codes.push("numeric_answer");
  }
  if (type === "fill_blank" && !/_{2,}|\.\.\./.test(prompt)) codes.push("fill_blank_no_gap");

  // 4. Answer leak — the prompt must not contain the answer (MCQ options excluded).
  if (type !== "mcq" && type !== "true_false") {
    const a = normalize(answerText);
    if (a.length >= 4 && normalize(prompt).includes(a)) codes.push("answer_leak");
  }

  // 5. Citation — must be a verbatim span of the cited chunk.
  const quote = String(candidate.citation?.quote ?? "");
  let span: GateResult["span"];
  if (quote.trim().length < MIN_QUOTE_CHARS) {
    codes.push("citation_missing");
  } else {
    const found = findSpan(ctx.chunkText, quote);
    if (!found) codes.push("citation_not_verbatim");
    else span = found;
  }

  // 6. Near-duplicate against already published prompts.
  const promptTokens = tokenSet(prompt);
  for (const existing of ctx.existingPrompts ?? []) {
    if (jaccard(promptTokens, tokenSet(existing)) >= DUPLICATE_THRESHOLD) {
      codes.push("duplicate");
      break;
    }
  }

  return codes.length === 0
    ? { decision: "pass", reasonCodes: [], span }
    : { decision: "fail", reasonCodes: codes, span };
}
