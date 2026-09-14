import { skill, STORIES } from "../content";
import { fill } from "../fill";
import { int, pick, type Rng, uid } from "../random";
import type { Problem, SkillId, Step } from "../types";
import { diagnose, digit, exprText, simulateWrong } from "./diagnose";

/**
 * 問題の生成。数値は「間違い方ごとに違う答えになる」ように選ぶ。
 * recent には最近出した "a,b" を渡すと、同じ問題が続かないようにする。
 */
export type Generator = (skillId: SkillId, rng: Rng, recent?: Set<string>) => Problem;

const numberStep = (answer: number, prompt = "こたえを いれよう", unit?: string): Step => ({ type: "number", answer, prompt, unit });

function base(skillId: SkillId, kind: Problem["kind"], a: number, b: number, layout: Problem["layout"], steps: Step[], extra: Partial<Problem> = {}): Problem {
  return { id: uid(), skillId, kind, a, b, answer: steps[steps.length - 1].answer, layout, steps, ...extra };
}

/**
 * どの間違い方をまねしても、答えがほかと重ならず、その間違い方として判定されるか。
 * strict=false（九九）は、となりの九九だけ確かめる（2×2 や 3×3 など、重なる九九も出したいので）。
 */
export function isUnambiguous(p: Problem, strict = true): boolean {
  const mcs = skill(p.skillId).misconceptions;
  for (let step = 0; step < p.steps.length; step++) {
    const seen = new Set<number>([p.steps[step].answer]);
    for (const mc of mcs) {
      if (!strict && mc !== "neighbor_fact") continue;
      const wrong = simulateWrong(p, step, mc);
      if (wrong === null) continue;
      if (seen.has(wrong) || wrong < 0 || diagnose(p, step, wrong) !== mc) return false;
      seen.add(wrong);
    }
  }
  return true;
}

/** 条件に合う問題ができるまで作り直す（make が null を返したら条件外） */
function generate(make: () => Problem | null, recent: Set<string> | undefined, strict = true): Problem {
  let fallback: Problem | null = null;
  for (let i = 0; i < 2000; i++) {
    const p = make();
    if (!p || !isUnambiguous(p, strict)) continue;
    if (!recent?.has(`${p.a},${p.b}`)) return p;
    fallback = p;
  }
  if (fallback) return fallback;
  throw new Error("問題を作れませんでした");
}

/** 8+5 のような 1けた＋1けた、くり上がりあり */
const add1d1dCarry: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a = int(rng, 2, 9);
    const b = int(rng, Math.max(2, 11 - a), 9);
    return base(skillId, "add", a, b, "inline", [numberStep(a + b)]);
  }, recent);

/** 38+25 のような 2けた＋2けた、答えは2けた */
const add2d2dCarry: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a1 = int(rng, 2, 9);
    const b1 = int(rng, Math.max(2, 11 - a1), 9);
    const a10 = int(rng, 1, 7);
    const b10 = int(rng, 1, 8 - a10);
    const a = a10 * 10 + a1;
    const b = b10 * 10 + b1;
    return base(skillId, "add", a, b, "vertical", [numberStep(a + b)]);
  }, recent);

/** 67+85 のような 2けた＋2けた、答えが3けた（くり上がり1〜2回） */
const add2d2dTo3d: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a = int(rng, 25, 98);
    const b = int(rng, 25, 98);
    const onesCarry = digit(a, 1) + digit(b, 1) >= 10;
    // 百の位へくり上がり、答えが100〜198。くり上がり2回を多めに
    if (a + b < 110 || (!onesCarry && rng() < 0.7)) return null;
    return base(skillId, "add", a, b, "vertical", [numberStep(a + b)]);
  }, recent);

/** 52-27 のような 2けた−2けた、くり下がりあり */
const sub2d2dBorrow: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a1 = int(rng, 0, 8);
    const b1 = int(rng, a1 + 1, 9);
    const a10 = int(rng, 3, 9);
    const b10 = int(rng, 1, a10 - 2);
    const a = a10 * 10 + a1;
    const b = b10 * 10 + b1;
    return base(skillId, "sub", a, b, "vertical", [numberStep(a - b)]);
  }, recent);

/** 134-56 のような 3けた−2けた、くり下がり2回（103-45 のような十の位が0も含む） */
const sub3d2dBorrow: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a = int(rng, 100, 180);
    const b = int(rng, 12, 98);
    const d = a - b;
    const double = digit(a, 1) < digit(b, 1) && digit(a, 10) - 1 < digit(b, 10);
    if (!double || d < 10 || d >= 100) return null;
    return base(skillId, "sub", a, b, "vertical", [numberStep(d)]);
  }, recent);

/** 九九。×1 は除き、後半（5〜9）を多めに出す */
const mulDan =
  (n: number): Generator =>
  (skillId, rng, recent) =>
    generate(
      () => {
        const m = rng() < 0.6 ? int(rng, 5, 9) : int(rng, 2, 9);
        return base(skillId, "mul", n, m, "inline", [numberStep(n * m)]);
      },
      recent,
      false,
    );

/** 九九ミックス：6〜9の段を多めに */
const mulMix: Generator = (skillId, rng, recent) =>
  generate(
    () => {
      const n = rng() < 0.65 ? int(rng, 6, 9) : int(rng, 2, 5);
      const m = int(rng, 2, 9);
      return base(skillId, "mul", n, m, "inline", [numberStep(n * m)]);
    },
    recent,
    false,
  );

/** 7 × □ = 42 */
const mulMissing: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a = int(rng, 3, 9);
    let b = int(rng, 3, 9);
    if (b === a) b = b === 9 ? 3 : b + 1;
    return base(skillId, "mul_missing", a, b, "missing", [numberStep(b, "□に はいる かずは？")], { product: a * b });
  }, recent);

/** かけ算の文章題：式を選ぶ → 答えを入れる */
const mulWord: Generator = (skillId, rng, recent) =>
  generate(() => {
    const a = int(rng, 2, 9); // 1つ分
    let b = int(rng, 2, 9); // いくつ分
    if (b === a) b = b === 9 ? 2 : b + 1;
    const story = pick(rng, STORIES);
    const choices = [exprText.mul(a, b), exprText.mul(b, a), exprText.add(a, b)].sort(() => rng() - 0.5);
    return base(
      skillId,
      "mul_word",
      a,
      b,
      "story",
      [
        { type: "choice", answer: choices.indexOf(exprText.mul(a, b)), choices, prompt: "しきを えらぼう" },
        numberStep(a * b, "こたえは？", story.unit),
      ],
      { story: fill(story.text, { a: String(a), b: String(b) }) },
    );
  }, recent);

/** 1m20cm = □cm ／ 135cm = 1m□cm */
const lengthMcm: Generator = (skillId, rng, recent) =>
  generate(() => {
    const m = int(rng, 1, 3);
    const cm = rng() < 0.3 ? int(rng, 1, 9) : int(rng, 11, 99);
    if (rng() < 0.5) {
      return base(skillId, "len_to_cm", m, cm, "length", [numberStep(m * 100 + cm, "なんcm？", "cm")]);
    }
    if (cm === 1 || cm === m) return null; // ヒントの「1m」などの数字と、答えが同じにならないように
    return base(skillId, "len_to_mcm", m, cm, "length", [numberStep(cm, "□cmは？", "cm")], { cm: m * 100 + cm });
  }, recent);

export const generators: Record<string, Generator> = {
  add1d1dCarry,
  add2d2dCarry,
  add2d2dTo3d,
  sub2d2dBorrow,
  sub3d2dBorrow,
  mulDan2: mulDan(2),
  mulDan3: mulDan(3),
  mulDan4: mulDan(4),
  mulDan5: mulDan(5),
  mulDan6: mulDan(6),
  mulDan7: mulDan(7),
  mulDan8: mulDan(8),
  mulDan9: mulDan(9),
  mulMix,
  mulMissing,
  mulWord,
  lengthMcm,
};
