import { CONTENT_VERSION, skill } from "../domain/content";
import { hintText } from "../domain/hints";
import { diagnose } from "../domain/math/diagnose";
import { generators } from "../domain/math/generators";
import { type Rng, uid } from "../domain/random";
import type { AnswerEvent, HintVisual, LessonPlan, MisconceptionId, Problem, ProblemOutcome, SkillId } from "../domain/types";

/**
 * 授業の進行（純粋な状態遷移）。画面・読み上げ・保存は呼び出し側が行う。
 *
 * answering ─正解→ (次のステップがあれば answering のまま step+1)
 *    │           └ 最後のステップ → correct ─next→ (think?) → 次の問題 / choice / done
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
  step: number;
  attemptNo: number; // このステップで何回目の回答か
  hintLevel: 0 | 1 | 2 | 3; // このステップのヒント段階
  hint: { text: string; visual: HintVisual } | null;
  firstMisconception: MisconceptionId | null;
  problemStartedAt: number;
  firstMs: number | null;
  missed: boolean; // この問題で間違えた・ヒントを見た
  maxHintLevel: number;
  current: { misconceptions: string[]; answerEventIds: string[]; wrongEventIds: string[] };
  outcomes: ProblemOutcome[];
  recentPairs: string[];
  thinkAsked: boolean;
  chosenSkill: SkillId | null;
  timeUp: boolean;
  /** 直前の回答で、次のステップに進んだ */
  stepAdvanced: boolean;
  /** えらぶ問題で、まちがえて えらんだ 選択肢（もう えらべない） */
  eliminated: number[];
}

export function startLesson(plan: LessonPlan, now: number, rng: Rng): LessonState {
  const base: LessonState = {
    plan,
    index: 0,
    stage: "answering",
    problem: null,
    isTwin: false,
    step: 0,
    attemptNo: 1,
    hintLevel: 0,
    hint: null,
    firstMisconception: null,
    problemStartedAt: now,
    firstMs: null,
    missed: false,
    maxHintLevel: 0,
    current: { misconceptions: [], answerEventIds: [], wrongEventIds: [] },
    outcomes: [],
    recentPairs: [],
    thinkAsked: false,
    chosenSkill: null,
    timeUp: false,
    stepAdvanced: false,
    eliminated: [],
  };
  return loadItem(base, now, rng);
}

function newProblem(s: LessonState, skillId: SkillId, now: number, rng: Rng, isTwin: boolean): LessonState {
  const gen = generators[skill(skillId).generator];
  const problem = gen(skillId, rng, new Set(s.recentPairs), s.plan.levels?.[skillId] ?? 1);
  return {
    ...s,
    stage: "answering",
    problem,
    isTwin,
    step: 0,
    attemptNo: 1,
    hintLevel: 0,
    hint: null,
    firstMisconception: null,
    problemStartedAt: now,
    firstMs: null,
    missed: false,
    maxHintLevel: 0,
    current: { misconceptions: [], answerEventIds: [], wrongEventIds: [] },
    recentPairs: [...s.recentPairs, `${problem.a},${problem.b}`].slice(-12),
    stepAdvanced: false,
    eliminated: [],
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

export const currentStep = (s: LessonState) => s.problem?.steps[s.step];

export function answer(s: LessonState, given: number, now: number): { state: LessonState; event: AnswerEvent } {
  if (s.stage !== "answering" || !s.problem) throw new Error("not answering");
  const p = s.problem;
  const isChoice = p.steps[s.step].type === "choice";
  const ms = now - s.problemStartedAt;
  const misconception = diagnose(p, s.step, given);
  const correct = misconception === null;
  const event: AnswerEvent = {
    id: uid(),
    type: "answer",
    sessionId: s.plan.sessionId,
    at: new Date(now).toISOString(),
    problem: p,
    step: s.step,
    given,
    correct,
    attemptNo: s.attemptNo,
    hintLevel: s.hintLevel,
    misconception,
    ms,
    phase: currentPhase(s),
    contentVersion: CONTENT_VERSION,
  };
  const current = {
    misconceptions: correct ? s.current.misconceptions : [...s.current.misconceptions, misconception!],
    answerEventIds: [...s.current.answerEventIds, event.id],
    wrongEventIds: correct ? s.current.wrongEventIds : [...s.current.wrongEventIds, event.id],
  };
  const missed = s.missed || !correct;
  const isLastStep = s.step === p.steps.length - 1;
  // 最後のステップを初めて答えた時間を、流暢さの記録に使う
  const firstMs = s.firstMs ?? (isLastStep ? ms : null);

  const outcome = (revealed: boolean): ProblemOutcome => ({
    problem: p,
    phase: currentPhase(s),
    firstTryCorrect: !missed && s.maxHintLevel === 0,
    maxHintLevel: s.maxHintLevel,
    revealed,
    firstMs: firstMs ?? ms,
    misconceptions: current.misconceptions,
    answerEventIds: current.answerEventIds,
    wrongEventIds: current.wrongEventIds,
    isTwin: s.isTwin,
  });

  if (correct && !isLastStep) {
    return {
      state: { ...s, current, missed, step: s.step + 1, attemptNo: 1, hintLevel: 0, hint: null, firstMisconception: null, stepAdvanced: true, eliminated: [] },
      event,
    };
  }
  if (correct) {
    return { state: { ...s, stage: "correct", firstMs, current, missed, outcomes: [...s.outcomes, outcome(false)], stepAdvanced: false }, event };
  }
  // 答えを見せるとき：ヒントを3つ使っても まちがえた／えらぶ問題で のこりが 正解だけに なった／2つから えらぶ問題で 2回 まちがえた
  const choiceCount = p.steps[s.step].choices?.length ?? 0;
  const remaining = isChoice ? choiceCount - s.eliminated.length - 1 : Infinity;
  const stepWrongs = s.attemptNo; // この回答を ふくめた まちがいの 回数
  if (s.hintLevel >= 3 || (isChoice && choiceCount >= 3 && remaining <= 1) || (isChoice && choiceCount === 2 && stepWrongs >= 2)) {
    return { state: { ...s, stage: "revealed", firstMs, current, missed, outcomes: [...s.outcomes, outcome(true)], stepAdvanced: false }, event };
  }
  // ヒントは推定した原因に沿って出す（分からない間違いなら、前に分かった原因を使う）
  const cause = misconception !== "unknown" ? misconception : s.firstMisconception;
  const level = (s.hintLevel + 1) as 1 | 2 | 3;
  return {
    state: {
      ...s,
      firstMs,
      current,
      missed,
      attemptNo: s.attemptNo + 1,
      hintLevel: level,
      maxHintLevel: Math.max(s.maxHintLevel, level),
      hint: hintText(p, s.step, cause, level),
      firstMisconception: s.firstMisconception ?? (misconception !== "unknown" ? misconception : null),
      stepAdvanced: false,
      // 3つ以上から えらぶ問題だけ、まちがえた選択肢を けす（2つだと 答えが わかって しまうため）
      eliminated: isChoice && choiceCount >= 3 ? [...s.eliminated, given] : s.eliminated,
    },
    event,
  };
}

/** 子どもが「ヒント」を押したとき（答える前でも使える） */
export function requestHint(s: LessonState): LessonState {
  if (s.stage !== "answering" || !s.problem || s.hintLevel >= 3) return s;
  const level = (s.hintLevel + 1) as 1 | 2 | 3;
  return {
    ...s,
    hintLevel: level,
    maxHintLevel: Math.max(s.maxHintLevel, level),
    hint: hintText(s.problem, s.step, s.firstMisconception, level),
    stepAdvanced: false,
  };
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
