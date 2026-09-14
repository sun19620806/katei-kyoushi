import { describe, expect, it } from "vitest";
import { SKILLS } from "../src/domain/content";
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
  enabledSkills: SKILLS.map((s) => s.id),
};

const mastered = (id: string): SkillState => ({ ...initialSkillState(id), attempts: 10, mastery: 0.9, masteredAt: "2026-09-01" });

describe("授業の計画", () => {
  it("はじめての日は、前提のないスキルから始まる", () => {
    const plan = planLesson({ profile, states: {}, stumbles: {}, mood: "futsu", today: "2026-09-14" });
    expect(plan.focusSkill).toBe("math.add.1d1d_carry");
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
      "math.add.2d2d_carry": mastered("math.add.2d2d_carry"),
      "math.mul.dan2": { ...initialSkillState("math.mul.dan2"), attempts: 5, mastery: 0.3 },
      "math.sub.2d2d_borrow": { ...initialSkillState("math.sub.2d2d_borrow"), attempts: 5, mastery: 0.5 },
    };
    const stumbles = {
      "math.sub.2d2d_borrow|smaller_from_larger": {
        key: "math.sub.2d2d_borrow|smaller_from_larger",
        skillId: "math.sub.2d2d_borrow",
        misconception: "smaller_from_larger",
        status: "confirmed" as const,
        evidence: ["a", "b"],
        firstSeen: "2026-09-13",
        lastSeen: "2026-09-14",
        noHintStreakSinceConfirmed: 0,
      },
    };
    const plan = planLesson({ profile, states, stumbles, mood: "futsu", today: "2026-09-14" });
    expect(plan.focusSkill).toBe("math.sub.2d2d_borrow");
    expect(plan.items[0].skillId).not.toBe("math.sub.2d2d_borrow"); // ウォームアップは得意なもの
  });
});

describe("授業の進行", () => {
  const rng = seededRng(1);
  const plan = planLesson({ profile, states: {}, stumbles: {}, mood: "futsu", today: "2026-09-14" });

  it("間違えるとヒントが1段ずつ進み、3段でも間違えたら答えを見せて、にた問題を出す", () => {
    let s = startLesson(plan, 0, rng);
    const wrong = s.problem!.answer + 100;
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
        s = answer(s, s.problem!.answer, 500).state;
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
    s = answer(s, s.problem!.answer, 500).state;
    s = next(s, 0, rng, true);
    expect(s.plan.items[s.index].phase).toBe("finale");
  });

  it("ヒントボタンでも段階が進む", () => {
    let s = startLesson(plan, 0, rng);
    s = requestHint(s);
    expect(s.hintLevel).toBe(1);
    expect(s.hint).not.toBeNull();
  });
});
