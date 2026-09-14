import { CONTENT_VERSION, skill } from "../domain/content";
import { diagnose } from "../domain/math/diagnose";
import { generators } from "../domain/math/generators";
import { hintText } from "../domain/hints";
import { type Rng, uid } from "../domain/random";
import type { AnswerEvent, HintVisual, LessonPlan, MisconceptionId, Problem, ProblemOutcome, SkillId } from "../domain/types";

/**
 * 授業の進行（純粋な状態遷移）。画面・読み上げ・保存は呼び出し側が行う。
 *
 * answering ─正解→ correct ─next→ (think?) → 次の問題 / choice / done
 *    └─不正解→ ヒント段階+1（最大3）→ answering
 *                 └ 段階3でも不正解 → revealed ─next→ にた問題（twin）
 */
export type Stage = "answering" | "correct" | "revealed" | "think" | "choice" | "done";

export interface LessonState {
  plan: LessonPlan;
  index: number;
  stage: Stage;
  problem: Problem | null;
  isTwin: boolean;
  attemptNo: number;
  hintLevel: 0 | 1 | 2 | 3;
  hint: { text: string; visual: HintVisual } | null;
  firstMisconception: MisconceptionId | null;
  problemStartedAt: number;
  firstMs: number | null;
  current: { misconceptions: string[]; answerEventIds: string[] };
  outcomes: ProblemOutcome[];
  recentPairs: string[];
  thinkAsked: boolean;
  chosenSkill: SkillId | null;
  timeUp: boolean;
}

export function startLesson(plan: LessonPlan, now: number, rng: Rng): LessonState {
  const base: LessonState = {
    plan,
    index: 0,
    stage: "answering",
    problem: null,
    isTwin: false,
    attemptNo: 1,
    hintLevel: 0,
    hint: null,
    firstMisconception: null,
    problemStartedAt: now,
    firstMs: null,
    current: { misconceptions: [], answerEventIds: [] },
    outcomes: [],
    recentPairs: [],
    thinkAsked: false,
    chosenSkill: null,
    timeUp: false,
  };
  return loadItem(base, now, rng);
}

function newProblem(s: LessonState, skillId: SkillId, now: number, rng: Rng, isTwin: boolean): LessonState {
  const gen = generators[skill(skillId).generator];
  const problem = gen(skillId, rng, new Set(s.recentPairs));
  return {
    ...s,
    stage: "answering",
    problem,
    isTwin,
    attemptNo: 1,
    hintLevel: 0,
    hint: null,
    firstMisconception: null,
    problemStartedAt: now,
    firstMs: null,
    current: { misconceptions: [], answerEventIds: [] },
    recentPairs: [...s.recentPairs, `${problem.a},${problem.b}`].slice(-12),
  };
}

function loadItem(s: LessonState, now: number, rng: Rng): LessonState {
  const item = s.plan.items[s.index];
  if (!item) return { ...s, stage: "done", problem: null };
  if (item.phase === "choice" && !s.chosenSkill) return { ...s, stage: "choice", problem: null };
  const skillId = item.phase === "choice" ? s.chosenSkill! : item.skillId;
  return newProblem(s, skillId, now, rng, false);
}

export const currentPhase = (s: LessonState) => s.plan.items[Math.min(s.index, s.plan.items.length - 1)].phase;

export function answer(s: LessonState, given: number, now: number): { state: LessonState; event: AnswerEvent } {
  if (s.stage !== "answering" || !s.problem) throw new Error("not answering");
  const p = s.problem;
  const ms = now - s.problemStartedAt;
  const misconception = diagnose(p, given);
  const correct = misconception === null;
  const event: AnswerEvent = {
    id: uid(),
    type: "answer",
    sessionId: s.plan.sessionId,
    at: new Date(now).toISOString(),
    problem: p,
    given,
    correct,
    attemptNo: s.attemptNo,
    hintLevel: s.hintLevel,
    misconception,
    ms,
    phase: currentPhase(s),
    contentVersion: CONTENT_VERSION,
  };
  const firstMs = s.firstMs ?? ms;
  const current = {
    misconceptions: correct ? s.current.misconceptions : [...s.current.misconceptions, misconception!],
    answerEventIds: [...s.current.answerEventIds, event.id],
  };

  const outcome = (revealed: boolean): ProblemOutcome => ({
    problem: p,
    phase: currentPhase(s),
    firstTryCorrect: correct && s.attemptNo === 1 && s.hintLevel === 0,
    maxHintLevel: s.hintLevel,
    revealed,
    firstMs,
    misconceptions: current.misconceptions,
    answerEventIds: current.answerEventIds,
    isTwin: s.isTwin,
  });

  if (correct) {
    return { state: { ...s, stage: "correct", firstMs, current, outcomes: [...s.outcomes, outcome(false)] }, event };
  }
  if (s.hintLevel >= 3) {
    return { state: { ...s, stage: "revealed", firstMs, current, outcomes: [...s.outcomes, outcome(true)] }, event };
  }
  // ヒントは最初に推定した原因に沿って出す（途中で原因が変わったら、新しい原因に合わせる）
  const cause = misconception !== "unknown" ? misconception : s.firstMisconception;
  const level = (s.hintLevel + 1) as 1 | 2 | 3;
  return {
    state: {
      ...s,
      firstMs,
      current,
      attemptNo: s.attemptNo + 1,
      hintLevel: level,
      hint: hintText(p, cause, level),
      firstMisconception: s.firstMisconception ?? (misconception !== "unknown" ? misconception : null),
    },
    event,
  };
}

/** 子どもが「ヒント」を押したとき（答える前でも使える） */
export function requestHint(s: LessonState): LessonState {
  if (s.stage !== "answering" || !s.problem || s.hintLevel >= 3) return s;
  const level = (s.hintLevel + 1) as 1 | 2 | 3;
  return { ...s, hintLevel: level, hint: hintText(s.problem, s.firstMisconception, level) };
}

/** 「先生に教えて」を出すか：メインの問題を初めてヒントなしで正解したとき */
export const shouldAskThink = (s: LessonState) =>
  s.stage === "correct" && !s.thinkAsked && currentPhase(s) === "main" && !!s.outcomes.at(-1)?.firstTryCorrect;

/**
 * 次へ進む。timeUp=true なら（仕上げの問題でなければ）残りを飛ばして仕上げの1問へ。
 * できた問題で終わるための工夫。
 */
export function next(s: LessonState, now: number, rng: Rng, timeUp = false): LessonState {
  if (timeUp && !s.timeUp) {
    const finale = s.plan.items.findIndex((i) => i.phase === "finale");
    if (finale > s.index) return loadItem({ ...s, index: finale, timeUp: true }, now, rng);
  }
  if (s.stage === "correct" && shouldAskThink(s)) return { ...s, stage: "think", thinkAsked: true };
  if (s.stage === "revealed" && !s.isTwin && s.problem) {
    return newProblem(s, s.problem.skillId, now, rng, true);
  }
  return loadItem({ ...s, index: s.index + 1 }, now, rng);
}

export function afterThink(s: LessonState, now: number, rng: Rng): LessonState {
  return loadItem({ ...s, index: s.index + 1 }, now, rng);
}

export function choose(s: LessonState, which: "easy" | "challenge", now: number, rng: Rng): LessonState {
  const skillId = which === "easy" ? s.plan.choiceOptions.easy : s.plan.choiceOptions.challenge;
  return newProblem({ ...s, chosenSkill: skillId }, skillId, now, rng, false);
}
