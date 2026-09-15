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

import { SKILLS } from "../src/domain/content";
import { planLesson } from "../src/domain/planner";
import { seededRng } from "../src/domain/random";
import { answer, startLesson } from "../src/engine/lesson";

describe("立てなおしと 授業エンジンの 結果が 同じ", () => {
  it("選ぶ問題で 答えを 見せた ときも、立てなおしで「答えを見た」に なる", () => {
    const profile = {
      name: "t", nameYomi: "t", teacherName: "n", teacherLook: "note" as const, inputMode: "tap" as const, favorites: [],
      problemsPerSession: 10, maxMinutes: 15, allowedFrom: "06:00", allowedTo: "21:00", speech: false, speechRate: 1, sound: false,
      parentPin: "0000", disabledSkills: [], subjects: ["math" as const, "japanese" as const],
    };
    const base = planLesson({ profile, states: {}, stumbles: {}, mood: "futsu", today: "2026-09-14" });
    const rng = seededRng(4);
    for (const skillId of ["jp.katakana", "math.number.compare", "math.shape.basic"]) {
      expect(SKILLS.some((s) => s.id === skillId)).toBe(true);
      const plan = { ...base, items: [{ phase: "main" as const, skillId }] };
      let s = startLesson(plan, 0, rng);
      const events = [];
      for (let k = 0; k < 6 && s.stage === "answering"; k++) {
        const st = s.problem!.steps[s.step];
        const wrong = st.choices!.findIndex((_, i) => i !== st.answer && !s.eliminated.includes(i));
        const r = answer(s, wrong, 1000 + k);
        events.push(r.event);
        s = r.state;
      }
      expect(s.stage, skillId).toBe("revealed");
      const rebuilt = rebuildOutcomes(events);
      expect(rebuilt, skillId).toHaveLength(1);
      expect(rebuilt[0].revealed).toBe(s.outcomes[0].revealed);
      expect(rebuilt[0].misconceptions).toEqual(s.outcomes[0].misconceptions);
    }
  });
});
