import { describe, expect, it } from "vitest";
import { rebuildOutcomes } from "../src/domain/recover";
import type { AnswerEvent, Problem } from "../src/domain/types";

const problem = (id: string, steps = 1): Problem => ({
  id,
  skillId: "math.mul.dan7",
  kind: "mul",
  a: 7,
  b: 8,
  answer: 56,
  layout: "inline",
  steps: Array.from({ length: steps }, () => ({ type: "number" as const, answer: 56, prompt: "" })),
});

let t = 0;
const ev = (p: Problem, over: Partial<AnswerEvent>): AnswerEvent => ({
  id: `e${++t}`,
  type: "answer",
  sessionId: "s",
  at: new Date(Date.UTC(2026, 8, 15, 0, 0, t)).toISOString(),
  problem: p,
  step: 0,
  given: 56,
  correct: true,
  attemptNo: 1,
  hintLevel: 0,
  misconception: null,
  ms: 3000,
  phase: "main",
  contentVersion: "x",
  ...over,
});

describe("とちゅうで とじた 授業の 立てなおし", () => {
  it("答え終わった 問題だけを 結果に する", () => {
    const p1 = problem("p1");
    const p2 = problem("p2");
    const p3 = problem("p3", 2);
    const outcomes = rebuildOutcomes([
      ev(p1, {}),
      ev(p2, { correct: false, given: 63, misconception: "neighbor_fact" }),
      ev(p2, { attemptNo: 2, hintLevel: 1 }),
      ev(p3, { step: 0 }), // 2ステップの 1つめだけ → 入れない
    ]);
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0].firstTryCorrect).toBe(true);
    expect(outcomes[1].firstTryCorrect).toBe(false);
    expect(outcomes[1].misconceptions).toEqual(["neighbor_fact"]);
    expect(outcomes[1].wrongEventIds).toHaveLength(1);
  });

  it("ヒント3つでも まちがえた 問題は「答えを見た」", () => {
    const p = problem("p");
    const outcomes = rebuildOutcomes([ev(p, { correct: false, hintLevel: 3, misconception: "unknown" })]);
    expect(outcomes[0].revealed).toBe(true);
  });
});
