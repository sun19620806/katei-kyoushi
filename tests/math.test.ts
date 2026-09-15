import { describe, expect, it } from "vitest";
import { SKILLS } from "../src/domain/content";
import { diagnose, digit, simulateWrong } from "../src/domain/math/diagnose";
import { generators } from "../src/domain/math/generators";
import { seededRng } from "../src/domain/random";
import type { Problem } from "../src/domain/types";

const N = 400;

describe("問題生成", () => {
  for (const s of SKILLS) {
    it(`${s.label}: 答えが正しく、条件を満たす`, () => {
      const rng = seededRng(42);
      for (let i = 0; i < N; i++) {
        const p = generators[s.generator](s.id, rng, undefined, (i % 3) as 0 | 1 | 2);
        const last = p.steps.at(-1)!;
        expect(last.answer).toBe(p.answer);
        switch (p.kind) {
          case "add":
            expect(p.answer).toBe(p.a + p.b);
            break;
          case "sub":
            expect(p.answer).toBe(p.a - p.b);
            expect(digit(p.a, 1)).toBeLessThan(digit(p.b, 1)); // くり下がりがある
            expect(p.answer).toBeGreaterThanOrEqual(10);
            break;
          case "mul":
            expect(p.answer).toBe(p.a * p.b);
            expect(p.b).toBeGreaterThanOrEqual(2);
            break;
          case "mul_missing":
            expect(p.a * p.answer).toBe(p.product);
            break;
          case "mul_word":
            expect(p.answer).toBe(p.a * p.b);
            expect(p.steps[0].choices![p.steps[0].answer]).toBe(`${p.a} × ${p.b}`);
            expect(p.story).not.toMatch(/\{/);
            break;
          case "len_to_cm":
            expect(p.answer).toBe(p.a * 100 + p.b);
            break;
          case "len_to_mcm":
            expect(p.a * 100 + p.answer).toBe(p.cm);
            break;
        }
        if (s.id === "math.add.2d2d_to3d") expect(p.answer).toBeGreaterThanOrEqual(100);
        if (s.id === "math.sub.3d2d_borrow") {
          expect(p.a).toBeGreaterThanOrEqual(100);
          expect(digit(p.a, 10) - 1).toBeLessThan(digit(p.b, 10)); // くり下がり2回
        }
      }
    });
  }
});

describe("間違いの原因の推定", () => {
  const strict = SKILLS.filter((s) => !/^math\.mul\.(dan\d|mix)$/.test(s.id));
  for (const s of strict) {
    it(`${s.label}: どの間違い方も、その原因として判定される`, () => {
      const rng = seededRng(7);
      for (let i = 0; i < N; i++) {
        const p = generators[s.generator](s.id, rng, undefined, (i % 3) as 0 | 1 | 2);
        p.steps.forEach((step, k) => {
          expect(diagnose(p, k, step.answer)).toBeNull();
          for (const mc of s.misconceptions) {
            const wrong = simulateWrong(p, k, mc);
            if (wrong !== null) expect(diagnose(p, k, wrong), `${p.a},${p.b} step${k} ${mc}`).toBe(mc);
          }
        });
      }
    });
  }

  const fact = (a: number, b: number): Problem => ({
    id: "x",
    skillId: "math.mul.dan7",
    kind: "mul",
    a,
    b,
    answer: a * b,
    layout: "inline",
    steps: [{ type: "number", answer: a * b, prompt: "" }],
  });

  it("九九: 代表的な間違いを判定する", () => {
    const p = fact(7, 8);
    expect(diagnose(p, 0, 63)).toBe("neighbor_fact");
    expect(diagnose(p, 0, 49)).toBe("neighbor_fact");
    expect(diagnose(p, 0, 48)).toBe("neighbor_dan");
    expect(diagnose(p, 0, 15)).toBe("add_instead");
    expect(diagnose(p, 0, 30)).toBe("unknown");
  });

  it("時こく：○分後 と ○分前 の どちらも 出る", () => {
    const rng = seededRng(3);
    const dirs = new Set<string>();
    for (let i = 0; i < 200; i++) dirs.add(generators.clockShift("math.time.shift", rng).clock!.dir!);
    expect(dirs).toEqual(new Set(["after", "before"]));
  });

  it("むずかしさ：九九の やさしめは ×2〜×5 だけ", () => {
    const rng = seededRng(9);
    for (let i = 0; i < 200; i++) {
      const p = generators.mulDan7("math.mul.dan7", rng, undefined, 0);
      expect(p.b).toBeLessThanOrEqual(5);
    }
  });

  it("3けたのひき算: 十の位が0のくり下がり（103−45）", () => {
    const p: Problem = { ...fact(0, 0), skillId: "math.sub.3d2d_borrow", kind: "sub", a: 103, b: 45, answer: 58, layout: "vertical", steps: [{ type: "number", answer: 58, prompt: "" }] };
    expect(diagnose(p, 0, 142)).toBe("smaller_from_larger"); // 1,|0-4|,|3-5|
    expect(diagnose(p, 0, 168)).toBe("borrow_no_decrement");
    expect(diagnose(p, 0, 68)).toBe("borrow_no_decrement");
  });
});
