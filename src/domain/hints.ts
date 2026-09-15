import { HINTS } from "./content";
import { fill } from "./fill";
import { digit } from "./math/diagnose";
import type { HintDef, HintVisual, MisconceptionId, Problem } from "./types";

export { fill };

/** 問題から、ヒント文に差し込む変数を作る */
export function problemVars(p: Problem): Record<string, string> {
  const single = p.kind === "add" && p.a < 10 && p.b < 10;
  const onesSum = single ? p.a + p.b : digit(p.a, 1) + digit(p.b, 1);
  const vars: Record<string, number> = {
    a: p.a,
    b: p.b,
    a1: digit(p.a, 1),
    a10: digit(p.a, 10),
    a100: digit(p.a, 100),
    b1: digit(p.b, 1),
    b10: digit(p.b, 10),
    ones_sum: onesSum,
    ones_sum_minus10: onesSum - 10,
    tens_sum: digit(p.a, 10) + digit(p.b, 10),
    a1_plus10: digit(p.a, 1) + 10,
    a10_minus1: digit(p.a, 10) - 1,
    n: p.a,
    m: p.b,
    m_minus1: p.b - 1,
    prev: p.a * (p.b - 1),
    product: p.product ?? 0,
    m_in_cm: p.a * 100,
    cm: p.cm ?? 0,
  };
  const text: Record<string, string> = {};
  if (p.unit) {
    Object.assign(vars, { ratio: p.unit.ratio, a_in_small: p.a * p.unit.ratio, total: p.unit.total ?? 0 });
    Object.assign(text, { big: p.unit.big, small: p.unit.small });
  }
  if (p.clock?.shift) {
    const after = p.clock.dir !== "before";
    const toHour = after ? 60 - p.clock.m : p.clock.m;
    Object.assign(vars, { shift: p.clock.shift, to_hour: toHour, rest: p.clock.shift - toHour });
    Object.assign(text, {
      dir_verb: after ? "すすめる" : "もどす",
      dir_label: after ? "後" : "前",
      hour_change: after ? "ふえる" : "へる",
    });
  }
  if (p.shape) text.target_def = SHAPE_DEFS[p.shape.target] ?? "";
  if (p.jp) Object.assign(text, { item_hint: "", jp_word: p.jp.word ?? "" });
  if (p.rule) {
    const step = p.rule === "step";
    Object.assign(text, {
      rule_l1: step ? "かける かずが 1 ふえると、こたえは いくつ ふえるかな？" : "かける じゅんばんを 入れかえても、こたえは おなじ だよ。",
      rule_l2: step ? "その だんを となえて、となりどうしの こたえを くらべよう。" : "左と 右の しきを くらべて、入れかわって いる かずを 見つけよう。",
      rule_l3: step ? "九九の ひょうで、となりの こたえとの ちがいを 見よう。" : "□に 入るのは、右の しきに ある かずの どちらかだよ。",
    });
  }
  if (p.graph) {
    const g = p.graph;
    Object.assign(text, {
      graph_l1: g.ask === "max" ? "いちばん 高く ○が つんで ある 列を さがそう。" : "きかれて いる 名前の 列を ゆびで おさえよう。",
      graph_l3: g.ask === "diff" ? "ふたつの 列の ○の かずを かぞえて、大きい ほうから 小さい ほうを ひこう。" : g.ask === "max" ? "いちばん 高い 列の ○を 下から かぞえよう。" : "その 列の ○を、上まで ぜんぶ かぞえよう。",
      graph_other: g.ask === "max" ? "いちばん 高い 列を 見て いるかな？" : "となりの 列を 読んで いないかな？ 下の 名前を たしかめよう。",
    });
  }
  if (p.addsub) Object.assign(text, { key: p.addsub.key, op_word: p.addsub.op === "add" ? "たしざん" : "ひきざん" });
  return { ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])), ...text };
}

const SHAPE_DEFS: Record<string, string> = {
  tri: "三角形は、3本の まっすぐな 線で かこまれた 形だよ。",
  quad: "四角形は、4本の まっすぐな 線で かこまれた 形だよ。",
  rect: "長方形は、4つの かどが みんな 直角の 四角形だよ。",
  square: "正方形は、かどが みんな 直角で、へんの 長さが おなじ 四角形。",
  right_tri: "直角三角形は、直角の かどが ある 三角形だよ。",
};

/**
 * ヒントを選ぶ。優先順：
 * (スキル, 原因) → (スキル, *) → (*, 原因) → (*, *)
 * step が指定されたヒントは、そのステップのときだけ使う。
 * (*, …) は九九の共通ヒントなので、九九の問題（文章題の答えのステップを含む）だけで使う。
 */
export function findHint(p: Problem, step: number, misconception: MisconceptionId | null, level: 1 | 2 | 3): HintDef | undefined {
  const m = misconception && misconception !== "unknown" ? misconception : "*";
  const isFact = p.kind === "mul" || (p.kind === "mul_word" && step === 1);
  const candidates: [string, string][] = [
    [p.skillId, m],
    [p.skillId, "*"],
    ["*", m],
    ["*", "*"],
  ];
  for (const [s, mc] of candidates) {
    // 共通ヒント（skillId: "*"）は、kind が合うもの。kind のない共通ヒントは九九用
    const ok = (h: HintDef) =>
      h.skillId === s &&
      h.misconception === mc &&
      h.level === level &&
      (s === "*" ? (h.kind ? h.kind === p.kind : isFact) : !h.kind || h.kind === p.kind);
    const h = HINTS.find((h) => ok(h) && h.step === step) ?? HINTS.find((h) => ok(h) && h.step === undefined);
    if (h) return h;
  }
  return undefined;
}

export function hintText(p: Problem, step: number, misconception: MisconceptionId | null, level: 1 | 2 | 3): { text: string; visual: HintVisual } | null {
  const h = findHint(p, step, misconception, level);
  if (!h) return null;
  const vars = problemVars(p);
  // 国語の3段目は「その問題だけのヒント」。無ければ2段目の共通ヒントをくり返さないよう、読みかえしをすすめる
  if (p.jp) vars.item_hint = p.jp.hints?.[step] ?? "もう いちど、はじめから ゆっくり 読んでみよう。";
  return { text: fill(h.text, vars), visual: h.visual ?? "none" };
}
