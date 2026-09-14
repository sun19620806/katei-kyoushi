import { skill, STORIES } from "../content";
import { fill } from "../fill";
import { int, pick, type Rng, uid } from "../random";
import type { Problem, SkillId, Step } from "../types";
import { diagnose, digit, exprText, shiftTime, simulateWrong } from "./diagnose";

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

type UnitPair = { big: string; small: string; ratio: number };

/** 単位のかきかえ：2m30cm = □cm ／ 135cm = 1m□cm（かさ・長さ共通） */
const unitConvert =
  (pairs: UnitPair[]): Generator =>
  (skillId, rng, recent) =>
    generate(() => {
      const u = pick(rng, pairs);
      const a = int(rng, 1, u.ratio === 1000 ? 2 : 3);
      const b =
        u.ratio === 10 ? int(rng, 1, 9) : u.ratio === 100 ? (rng() < 0.3 ? int(rng, 2, 9) : int(rng, 11, 99)) : pick(rng, [100, 200, 250, 300, 500, 600, 800]);
      const total = a * u.ratio + b;
      if (rng() < 0.5) {
        return base(skillId, "unit_to_small", a, b, "unit", [numberStep(total, `なん${u.small}？`, u.small)], { unit: { ...u, total } });
      }
      if (b === 1 || b === a || b === u.ratio) return null; // ヒントの数字と答えが同じにならないように
      return base(skillId, "unit_to_mixed", a, b, "unit", [numberStep(b, `□${u.small}は？`, u.small)], { unit: { ...u, total } });
    }, recent);

const lengthMcm = unitConvert([{ big: "m", small: "cm", ratio: 100 }]);
const volume = unitConvert([
  { big: "L", small: "dL", ratio: 10 },
  { big: "dL", small: "mL", ratio: 100 },
  { big: "L", small: "mL", ratio: 1000 },
]);

/** とけいを読む：なん時 → なん分 */
const clockRead: Generator = (skillId, rng, recent) =>
  generate(() => {
    const h = int(rng, 1, 12);
    const m = rng() < 0.75 ? int(rng, 1, 11) * 5 : int(rng, 1, 58);
    if (m % 5 === 0 && m / 5 === h) return null;
    return base(skillId, "clock_read", h, m, "clock", [numberStep(h, "なん時？", "時"), numberStep(m, "なん分？", "分")], { clock: { h, m } });
  }, recent);

/** ○分後・○分前の時こく（時をまたぐ） */
const clockShift: Generator = (skillId, rng, recent) =>
  generate(() => {
    const h = int(rng, 1, 11);
    const m = int(rng, 1, 11) * 5;
    const shift = int(rng, 2, 5) * 10;
    const dir = rng() < 0.6 ? "after" : "before";
    const crosses = dir === "after" ? m + shift >= 60 : m < shift;
    if (!crosses) return null;
    const t = shiftTime(h, m, dir === "after" ? shift : -shift);
    // ヒントの数字（のこりの分など）と答えが同じにならないように
    const toHour = dir === "after" ? 60 - m : m;
    const rest = shift - toHour;
    if ([toHour, rest, shift].includes(t.m) || [toHour, rest, shift].includes(t.h)) return null;
    return base(
      skillId,
      "clock_shift",
      h,
      m,
      "clock",
      [numberStep(t.h, "なん時？", "時"), numberStep(t.m, "なん分？", "分")],
      { clock: { h, m, shift, dir } },
    );
  }, recent);

/** 12この 1/4は なんこ？ */
const fractionOf: Generator = (skillId, rng, recent) =>
  generate(() => {
    const b = pick(rng, [2, 3, 4, 8]);
    const answer = int(rng, 2, b === 8 ? 3 : 6);
    const a = answer * b;
    if (answer === b) return null;
    return base(skillId, "fraction_of", a, b, "fraction", [numberStep(answer, "なんこ？", "こ")]);
  }, recent);

/** 1/b に色をぬった図をえらぶ */
const fractionShape: Generator = (skillId, rng, recent) =>
  generate(() => {
    const b = pick(rng, [2, 3, 4, 8]);
    const shape = pick(rng, ["circle", "rect", "tape"]);
    const other = pick(rng, [2, 3, 4, 8].filter((x) => x !== b));
    const options: [string, string | null][] = [
      [`frac:${b}:1:equal:${shape}`, null],
      [`frac:${b}:1:unequal:${shape}`, "unequal_parts"],
      [`frac:${other}:1:equal:${shape}`, "wrong_count"],
      [`frac:${b}:2:equal:${shape}`, "shaded_count"],
    ];
    const shuffled = options.sort(() => rng() - 0.5);
    return base(
      skillId,
      "fraction_shape",
      b,
      0,
      "shape",
      [
        {
          type: "choice",
          answer: shuffled.findIndex((o) => o[1] === null),
          choices: shuffled.map((o) => o[0]),
          choiceMcs: shuffled.map((o) => o[1]),
          prompt: `1/${b}に 色を ぬった 図は？`,
        },
      ],
    );
  }, recent);

/** 1000を3こ、100を0こ、10を5こ、1を2こ → 3052 */
const placeCompose: Generator = (skillId, rng, recent) =>
  generate(() => {
    const counts = [int(rng, 1, 9), int(rng, 1, 9), int(rng, 1, 9), int(rng, 1, 9)];
    counts[int(rng, 1, 3)] = 0; // 百・十・一のどれかを0に
    const [thousands, hundreds, tens, ones] = counts;
    const n = thousands * 1000 + hundreds * 100 + tens * 10 + ones;
    return base(skillId, "place_compose", thousands, n, "place", [numberStep(n, "あわせた かずは？")], {
      place: { thousands, hundreds, tens, ones },
    });
  }, recent);

const SHAPE_TARGETS: Record<string, { prompt: string; wrong: [string, string][] }> = {
  tri: { prompt: "三角形は どれ？", wrong: [["tri_open", "open_shape"], ["tri_curve", "curved_side"], ["quad", "side_count"]] },
  quad: { prompt: "四角形は どれ？", wrong: [["quad_open", "open_shape"], ["quad_curve", "curved_side"], ["pent", "side_count"]] },
  rect: { prompt: "長方形は どれ？", wrong: [["parallelogram", "no_right_angle"], ["rect_open", "open_shape"], ["right_tri", "side_count"]] },
  square: { prompt: "正方形は どれ？", wrong: [["rect", "unequal_sides"], ["rhombus", "no_right_angle"], ["square_open", "open_shape"]] },
  right_tri: { prompt: "直角三角形は どれ？", wrong: [["tri", "no_right_angle"], ["right_tri_open", "open_shape"], ["rect", "side_count"]] },
};

/** 形をえらぶ */
const shapePick: Generator = (skillId, rng, recent) =>
  generate(() => {
    const target = pick(rng, Object.keys(SHAPE_TARGETS));
    const t = SHAPE_TARGETS[target];
    const rot = () => pick(rng, [0, 0, 12, -15, 25, 90]);
    const options: [string, string | null][] = [[`shape:${target}:${rot()}`, null], ...t.wrong.map(([code, mc]): [string, string] => [`shape:${code}:${rot()}`, mc])];
    const shuffled = options.sort(() => rng() - 0.5);
    return base(
      skillId,
      "shape_pick",
      Object.keys(SHAPE_TARGETS).indexOf(target),
      0,
      "shape",
      [
        {
          type: "choice",
          answer: shuffled.findIndex((o) => o[1] === null),
          choices: shuffled.map((o) => o[0]),
          choiceMcs: shuffled.map((o) => o[1]),
          prompt: t.prompt,
        },
      ],
      { shape: { target } },
    );
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
  volume,
  clockRead,
  clockShift,
  fractionOf,
  fractionShape,
  placeCompose,
  shapePick,
};
