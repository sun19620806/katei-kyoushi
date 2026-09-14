import { describe, expect, it } from "vitest";
import { streakDays } from "../src/domain/dates";
import { finalizeSession } from "../src/domain/finalize";
import { initialSkillState, updateSkill, updateStumbles } from "../src/domain/learner";
import type { Problem, ProblemOutcome } from "../src/domain/types";

const prob = (a: number, b: number): Problem => ({
  id: `${a}-${b}`,
  skillId: "math.sub.2d2d_borrow",
  kind: "sub",
  a,
  b,
  answer: a - b,
  layout: "vertical",
  steps: [{ type: "number", answer: a - b, prompt: "" }],
});

const outcome = (over: Partial<ProblemOutcome> = {}): ProblemOutcome => ({
  problem: prob(52, 27),
  phase: "main",
  firstTryCorrect: true,
  maxHintLevel: 0,
  revealed: false,
  firstMs: 8000,
  misconceptions: [],
  answerEventIds: ["e1"],
  isTwin: false,
  ...over,
});

describe("スキル状態", () => {
  it("ヒントなし正解で習熟度が上がり、復習日が決まる", () => {
    const s = updateSkill(initialSkillState("math.sub.2d2d_borrow"), outcome(), "2026-09-14");
    expect(s.mastery).toBeCloseTo(0.25);
    expect(s.nextReview).toBe("2026-09-15");
    expect(s.everNoHint).toBe(true);
  });

  it("同じ日に何度正解しても、復習の箱は1日1回しか進まない", () => {
    let s = initialSkillState("math.sub.2d2d_borrow");
    for (let i = 0; i < 5; i++) s = updateSkill(s, outcome(), "2026-09-14");
    expect(s.box).toBe(0);
    s = updateSkill(s, outcome(), "2026-09-15");
    expect(s.box).toBe(1);
    expect(s.nextReview).toBe("2026-09-17");
  });

  it("答えを見せたら習熟度が下がり、翌日に復習", () => {
    let s = initialSkillState("math.sub.2d2d_borrow");
    for (let i = 0; i < 4; i++) s = updateSkill(s, outcome(), "2026-09-14");
    const before = s.mastery;
    s = updateSkill(s, outcome({ firstTryCorrect: false, revealed: true, maxHintLevel: 3 }), "2026-09-14");
    expect(s.mastery).toBeLessThan(before);
    expect(s.nextReview).toBe("2026-09-15");
  });

  it("1日で何問できても「身についた」にはならず、別の日の復習を通ってからなる", () => {
    let s = initialSkillState("math.sub.2d2d_borrow");
    for (let i = 0; i < 8; i++) s = updateSkill(s, outcome(), "2026-09-14");
    expect(s.masteredAt).toBeNull();
    s = updateSkill(s, outcome(), "2026-09-15"); // 箱1
    expect(s.masteredAt).toBeNull();
    s = updateSkill(s, outcome(), "2026-09-17"); // 箱2
    expect(s.masteredAt).toBe("2026-09-17");
  });
});

describe("つまずき", () => {
  const wrong = (a: number, b: number, id: string) =>
    outcome({ problem: prob(a, b), firstTryCorrect: false, maxHintLevel: 1, misconceptions: ["smaller_from_larger"], answerEventIds: [id, id + "b"] });

  it("違う問題で2回同じ間違い方 → 確認済み、その後ヒントなし3連続 → 解消", () => {
    let st = updateStumbles({}, wrong(52, 27, "e1"), "2026-09-14");
    expect(Object.values(st)[0].status).toBe("observed");
    st = updateStumbles(st, wrong(61, 34, "e2"), "2026-09-15");
    expect(Object.values(st)[0].status).toBe("confirmed");
    for (let i = 0; i < 3; i++) st = updateStumbles(st, outcome(), "2026-09-16");
    expect(Object.values(st)[0].status).toBe("resolved");
  });

  it("「分からない」間違いは、つまずきにしない", () => {
    const st = updateStumbles({}, outcome({ firstTryCorrect: false, misconceptions: ["unknown"] }), "2026-09-14");
    expect(Object.keys(st)).toHaveLength(0);
  });
});

describe("成長の判定と連続日数", () => {
  it("はじめてヒントなしで解けたこと、最後まで考えたことを見つける", () => {
    const r = finalizeSession(
      {},
      {},
      [outcome({ firstTryCorrect: false, maxHintLevel: 2 }), outcome()],
      "2026-09-14",
      1,
    );
    const kinds = r.episodes.map((e) => e.kind);
    expect(kinds).toContain("first_no_hint");
    expect(kinds).toContain("persisted");
  });

  it("連続日数", () => {
    expect(streakDays(["2026-09-12", "2026-09-13", "2026-09-14"], "2026-09-14")).toBe(3);
    expect(streakDays(["2026-09-12", "2026-09-13"], "2026-09-14")).toBe(2);
    expect(streakDays(["2026-09-10"], "2026-09-14")).toBe(0);
  });
});
