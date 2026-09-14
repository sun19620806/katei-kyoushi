import { describe, expect, it } from "vitest";
import { initialSkillState } from "../src/domain/learner";
import { planLesson } from "../src/domain/planner";
import { seededRng } from "../src/domain/random";
import type { Profile, SkillState } from "../src/domain/types";
import { answer, choose, next, requestHint, startLesson } from "../src/engine/lesson";

const profile: Profile = {
  name: "テスト",
  nameYomi: "てすと",
  teacherName: "ノート",
  favorites: [],
  problemsPerSession: 10,
  maxMinutes: 15,
  allowedFrom: "06:00",
  allowedTo: "21:00",
  speech: true,
  speechRate: 1,
  parentPin: "0000",
  disabledSkills: [],
};

const mastered = (id: string): SkillState => ({ ...initialSkillState(id), attempts: 10, mastery: 0.9, masteredAt: "2026-09-01" });

describe("授業の計画", () => {
  it("はじめての日は、2学期の最初のスキルが重点で、ウォームアップは1学期のふくしゅう", () => {
    const plan = planLesson({ profile, states: {}, stumbles: {}, mood: "futsu", today: "2026-09-14" });
    expect(plan.focusSkill).toBe("math.add.2d2d_to3d");
    expect(plan.items[0].skillId).toBe("math.add.1d1d_carry");
    expect(plan.warmupIsStrong).toBe(false);
    expect(plan.items.at(-1)!.phase).toBe("finale");
    expect(plan.items).toHaveLength(10);
  });

  it("つかれた日は問題が少ない", () => {
    const plan = planLesson({ profile, states: {}, stumbles: {}, mood: "tsukare", today: "2026-09-14" });
    expect(plan.items.length).toBeLessThan(10);
  });

  it("確認済みのつまずきがあるスキルを重点にする", () => {
    const states = {
      "math.add.1d1d_carry": mastered("math.add.1d1d_carry"),
      "math.add.2d2d_to3d": mastered("math.add.2d2d_to3d"),
      "math.mul.dan2": { ...initialSkillState("math.mul.dan2"), attempts: 5, mastery: 0.3 },
      "math.sub.3d2d_borrow": { ...initialSkillState("math.sub.3d2d_borrow"), attempts: 5, mastery: 0.5 },
    };
    const stumbles = {
      "math.sub.3d2d_borrow|smaller_from_larger": {
        key: "math.sub.3d2d_borrow|smaller_from_larger",
        skillId: "math.sub.3d2d_borrow",
        misconception: "smaller_from_larger",
        status: "confirmed" as const,
        evidence: ["a", "b"],
        firstSeen: "2026-09-13",
        lastSeen: "2026-09-14",
        noHintStreakSinceConfirmed: 0,
      },
    };
    const plan = planLesson({ profile, states, stumbles, mood: "futsu", today: "2026-09-14" });
    expect(plan.focusSkill).toBe("math.sub.3d2d_borrow");
    expect(plan.items[0].skillId).not.toBe("math.sub.3d2d_borrow"); // ウォームアップは得意なもの
  });

  it("「出さない」にしたスキルは出ない。前提が出さないスキルでも先に進める", () => {
    const off = { ...profile, disabledSkills: ["math.add.2d2d_to3d", "math.sub.3d2d_borrow"] };
    const plan = planLesson({ profile: off, states: {}, stumbles: {}, mood: "futsu", today: "2026-09-14" });
    expect(plan.focusSkill).toBe("math.mul.dan5");
    expect(plan.items.map((i) => i.skillId)).not.toContain("math.add.2d2d_to3d");
  });
});

describe("授業の進行", () => {
  const rng = seededRng(1);
  const plan = planLesson({ profile, states: {}, stumbles: {}, mood: "futsu", today: "2026-09-14" });

  it("間違えるとヒントが1段ずつ進み、3段でも間違えたら答えを見せて、にた問題を出す", () => {
    let s = startLesson(plan, 0, rng);
    const wrong = s.problem!.answer + 57;
    for (let level = 1; level <= 3; level++) {
      s = answer(s, wrong, 1000).state;
      expect(s.stage).toBe("answering");
      expect(s.hintLevel).toBe(level);
      expect(s.hint?.text).toBeTruthy();
      expect(s.hint!.text).not.toMatch(/\{/); // 変数の差し込み漏れがない
    }
    s = answer(s, wrong, 2000).state;
    expect(s.stage).toBe("revealed");
    expect(s.outcomes.at(-1)!.revealed).toBe(true);
    s = next(s, 3000, rng);
    expect(s.isTwin).toBe(true);
    expect(s.stage).toBe("answering");
  });

  it("全問正解で最後まで進み、途中で選択の場面がある", () => {
    let s = startLesson(plan, 0, rng);
    let sawChoice = false;
    let sawThink = false;
    for (let guard = 0; guard < 50 && s.stage !== "done"; guard++) {
      if (s.stage === "choice") {
        sawChoice = true;
        s = choose(s, "challenge", 0, rng);
      } else if (s.stage === "think") {
        sawThink = true;
        s = next({ ...s, stage: "correct", thinkAsked: true }, 0, rng);
      } else if (s.stage === "answering") {
        s = answer(s, s.problem!.steps[s.step].answer, 500).state;
      } else {
        s = next(s, 0, rng);
      }
    }
    expect(s.stage).toBe("done");
    expect(sawChoice).toBe(true);
    expect(sawThink).toBe(true);
    expect(s.outcomes.every((o) => o.firstTryCorrect)).toBe(true);
  });

  it("時間切れのときは、仕上げの1問に飛ぶ", () => {
    let s = startLesson(plan, 0, rng);
    s = answer(s, s.problem!.steps[0].answer, 500).state;
    s = next(s, 0, rng, true);
    expect(s.plan.items[s.index].phase).toBe("finale");
  });

  it("ヒントボタンでも段階が進む", () => {
    let s = startLesson(plan, 0, rng);
    s = requestHint(s);
    expect(s.hintLevel).toBe(1);
    expect(s.hint).not.toBeNull();
  });

  it("文章題：式を選ぶ → 答えを入れる。式を間違えたら原因に合ったヒント", () => {
    const wordPlan = { ...plan, items: [{ phase: "main" as const, skillId: "math.mul.word" }, ...plan.items.slice(-1)] };
    let s = startLesson(wordPlan, 0, rng);
    const p = s.problem!;
    expect(p.steps).toHaveLength(2);
    const reversed = p.steps[0].choices!.indexOf(`${p.b} × ${p.a}`);
    s = answer(s, reversed, 100).state;
    expect(s.step).toBe(0);
    expect(s.hint?.text).toContain("じゅん");
    s = answer(s, p.steps[0].answer, 200).state;
    expect(s.step).toBe(1);
    expect(s.stepAdvanced).toBe(true);
    expect(s.hint).toBeNull();
    s = answer(s, p.answer, 300).state;
    expect(s.stage).toBe("correct");
    expect(s.outcomes.at(-1)!.firstTryCorrect).toBe(false);
    expect(s.outcomes.at(-1)!.misconceptions).toEqual(["order_reversed"]);
  });
});
