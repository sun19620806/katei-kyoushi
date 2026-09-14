import { describe, expect, it } from "vitest";
import { SKILLS } from "../src/domain/content";
import { diagnose } from "../src/domain/math/diagnose";
import { generators } from "../src/domain/math/generators";
import { seededRng } from "../src/domain/random";
import type { Problem } from "../src/domain/types";

const ones = (n: number) => n % 10;
const tens = (n: number) => Math.floor(n / 10);

/** 間違い方をまねした答え */
function simulate(p: Problem, mc: string): number {
  const { a, b } = p;
  switch (mc) {
    case "no_carry":
      return p.answer - 10;
    case "concat_ones":
      return (tens(a) + tens(b)) * 100 + ones(a) + ones(b);
    case "count_slip":
    case "calc_slip":
      return p.answer + 1;
    case "smaller_from_larger":
      return (tens(a) - tens(b)) * 10 + (ones(b) - ones(a));
    case "borrow_no_decrement":
      return (tens(a) - tens(b)) * 10 + (ones(a) + 10 - ones(b));
    case "neighbor_fact":
      return a * (b + 1);
    case "neighbor_dan":
      return (a + 1) * b;
    case "add_instead":
      return a + b;
  }
  throw new Error(mc);
}

describe("問題生成", () => {
  for (const s of SKILLS) {
    it(`${s.label}: 答えが正しく、条件を満たす`, () => {
      const rng = seededRng(42);
      for (let i = 0; i < 500; i++) {
        const p = generators[s.generator](s.id, rng);
        if (p.kind === "add") expect(p.answer).toBe(p.a + p.b);
        if (p.kind === "sub") {
          expect(p.answer).toBe(p.a - p.b);
          expect(ones(p.a)).toBeLessThan(ones(p.b)); // くり下がりがある
          expect(p.answer).toBeGreaterThanOrEqual(10);
        }
        if (s.id === "math.add.2d2d_carry") {
          expect(ones(p.a) + ones(p.b)).toBeGreaterThanOrEqual(11);
          expect(p.answer).toBeLessThan(100);
        }
        if (p.kind === "mul") expect(p.b).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

describe("間違いの原因の推定", () => {
  const unambiguous = SKILLS.filter((s) => !s.id.startsWith("math.mul"));
  for (const s of unambiguous) {
    it(`${s.label}: どの間違い方も、その原因として判定される`, () => {
      const rng = seededRng(7);
      for (let i = 0; i < 500; i++) {
        const p = generators[s.generator](s.id, rng);
        expect(diagnose(p, p.answer)).toBeNull();
        for (const mc of s.misconceptions) expect(diagnose(p, simulate(p, mc)), `${p.a},${p.b} ${mc}`).toBe(mc);
      }
    });
  }

  it("九九: 代表的な間違いを判定する", () => {
    const p: Problem = { id: "x", skillId: "math.mul.dan7", kind: "mul", a: 7, b: 8, answer: 56, layout: "inline" };
    expect(diagnose(p, 63)).toBe("neighbor_fact");
    expect(diagnose(p, 49)).toBe("neighbor_fact");
    expect(diagnose(p, 48)).toBe("neighbor_dan");
    expect(diagnose(p, 15)).toBe("add_instead");
    expect(diagnose(p, 30)).toBe("unknown");
  });
});
