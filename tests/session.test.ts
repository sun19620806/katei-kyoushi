import { beforeEach, describe, expect, it } from "vitest";
import { commitSession, db, recoverUnfinishedSessions, studyDays } from "../src/db/db";
import { addDays, ymd } from "../src/domain/dates";
import type { ProblemOutcome } from "../src/domain/types";

const outcome = (id: string): ProblemOutcome => ({
  problem: { id, skillId: "math.mul.dan7", kind: "mul", a: 7, b: 8, answer: 56, layout: "inline", steps: [{ type: "number", answer: 56, prompt: "" }] },
  phase: "main",
  firstTryCorrect: true,
  maxHintLevel: 0,
  revealed: false,
  firstMs: 3000,
  misconceptions: [],
  answerEventIds: [],
  wrongEventIds: [],
  isTwin: false,
});

const finish = (sessionId: string, day: string, empty = false) => ({
  id: `${sessionId}-f`,
  type: "session" as const,
  sessionId,
  at: new Date(`${day}T10:00:00`).toISOString(),
  kind: "finish" as const,
  minutes: 5,
  empty,
});

describe("授業の しめくくり", () => {
  beforeEach(async () => {
    await Promise.all([db.events.clear(), db.skillStates.clear(), db.stumbles.clear(), db.episodes.clear()]);
  });

  it("れんぞくの シールは その日 はじめて といた ときだけ、やめる だけでは 出ない", async () => {
    const today = ymd();
    for (const n of [2, 1]) await commitSession(finish(`d${n}`, addDays(today, -n)), [outcome(`p${n}`)], addDays(today, -n));
    const third = await commitSession(finish("d0", today), [outcome("p0")], today);
    expect(third?.result.episodes.filter((e) => e.kind === "streak")).toHaveLength(1);

    // 同じ日に もう1回（問題なしで やめる・問題を とく）→ シールは ふえない
    const empty = await commitSession(finish("e1", today, true), [], today);
    const again = await commitSession(finish("e2", today), [outcome("p9")], today);
    expect(empty?.result.episodes).toHaveLength(0);
    expect(again?.result.episodes.filter((e) => e.kind === "streak")).toHaveLength(0);
    expect(await db.episodes.where("kind").equals("streak").count()).toBe(1);
  });

  it("つぎの日に 問題なしで やめても、きのうの シールが ふえない", async () => {
    const today = ymd();
    for (const n of [3, 2, 1]) await commitSession(finish(`d${n}`, addDays(today, -n)), [outcome(`p${n}`)], addDays(today, -n));
    expect(await db.episodes.where("kind").equals("streak").count()).toBe(1);
    await commitSession(finish("quit", today, true), [], today);
    expect(await db.episodes.where("kind").equals("streak").count()).toBe(1);
    expect(await studyDays()).not.toContain(today);
  });

  it("おわりの 記録と 学習の 記録は いっしょに 書かれ、2回目は 何もしない", async () => {
    const today = ymd();
    const first = await commitSession(finish("s1", today), [outcome("p1")], today);
    expect(first).not.toBeNull();
    expect(await db.skillStates.get("math.mul.dan7")).toBeTruthy();
    expect(await commitSession(finish("s1", today), [outcome("p2")], today)).toBeNull();
    expect((await db.skillStates.get("math.mul.dan7"))?.attempts).toBe(1);
  });

  it("消えた スキルの 記録が あっても 立てなおしが 止まらない", async () => {
    const at = new Date().toISOString();
    await db.events.bulkPut([
      { id: "st", type: "session", sessionId: "old", at, kind: "start", mood: "futsu" },
      {
        id: "a1", type: "answer", sessionId: "old", at, step: 0, given: 1, correct: true, attemptNo: 1, hintLevel: 0, misconception: null, ms: 1000, phase: "main", contentVersion: "x",
        problem: { ...outcome("gone").problem, skillId: "math.removed.skill" },
      },
    ]);
    await recoverUnfinishedSessions();
    const fin = await db.events.where("sessionId").equals("old").filter((e) => e.type === "session" && e.kind === "finish").count();
    expect(fin).toBe(1);
  });
});
