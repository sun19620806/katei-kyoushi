import type { Problem, SkillId } from "../types";
import { int, type Rng, uid } from "../random";

/**
 * 問題の生成。数値は「間違い方ごとに違う答えになる」ように選ぶ。
 * recent には最近出した "a,b" を渡すと、同じ問題が続かないようにする。
 */
export type Generator = (skillId: SkillId, rng: Rng, recent?: Set<string>) => Problem;

const make = (skillId: SkillId, kind: Problem["kind"], a: number, b: number, layout: Problem["layout"]): Problem => ({
  id: uid(),
  skillId,
  kind,
  a,
  b,
  answer: kind === "add" ? a + b : kind === "sub" ? a - b : a * b,
  layout,
});

function retry(gen: () => [number, number], recent?: Set<string>): [number, number] {
  let pair = gen();
  for (let i = 0; i < 20 && recent?.has(pair.join(",")); i++) pair = gen();
  return pair;
}

/** 8+5 のような 1けた＋1けた、くり上がりあり */
const add1d1dCarry: Generator = (skillId, rng, recent) => {
  const [a, b] = retry(() => {
    for (;;) {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      if (a + b >= 11) return [a, b]; // 10ちょうどは「くり上がりの1を忘れる」と区別できないので除く
    }
  }, recent);
  return make(skillId, "add", a, b, "inline");
};

/** 38+25 のような 2けた＋2けた、一の位でくり上がり、答えは2けた */
const add2d2dCarry: Generator = (skillId, rng, recent) => {
  const [a, b] = retry(() => {
    for (;;) {
      const a1 = int(rng, 2, 9);
      const b1 = int(rng, 2, 9);
      const a10 = int(rng, 1, 7);
      const b10 = int(rng, 1, 7);
      if (a1 + b1 >= 11 && a10 + b10 <= 8) return [a10 * 10 + a1, b10 * 10 + b1];
    }
  }, recent);
  return make(skillId, "add", a, b, "vertical");
};

/** 52-27 のような 2けた−2けた、くり下がりあり */
const sub2d2dBorrow: Generator = (skillId, rng, recent) => {
  const [a, b] = retry(() => {
    for (;;) {
      const a1 = int(rng, 0, 8);
      const b1 = int(rng, 1, 9);
      const a10 = int(rng, 3, 9);
      const b10 = int(rng, 1, a10 - 2);
      // b1-a1 が 5 だと「大きいほうから引く」と「十の位を減らし忘れ」が同じ答えになるので除く
      if (b1 > a1 && b1 - a1 !== 5) return [a10 * 10 + a1, b10 * 10 + b1];
    }
  }, recent);
  return make(skillId, "sub", a, b, "vertical");
};

/** 九九。×1 はヒントが作りにくく簡単すぎるので除き、後半（5〜9）を少し多めに出す */
const mulDan =
  (n: number): Generator =>
  (skillId, rng, recent) => {
    const [a, b] = retry(() => {
      const m = rng() < 0.6 ? int(rng, 5, 9) : int(rng, 2, 9);
      return [n, m];
    }, recent);
    return make(skillId, "mul", a, b, "inline");
  };

export const generators: Record<string, Generator> = {
  add1d1dCarry,
  add2d2dCarry,
  sub2d2dBorrow,
  mulDan2: mulDan(2),
  mulDan3: mulDan(3),
  mulDan4: mulDan(4),
  mulDan5: mulDan(5),
  mulDan6: mulDan(6),
  mulDan7: mulDan(7),
  mulDan8: mulDan(8),
  mulDan9: mulDan(9),
};
