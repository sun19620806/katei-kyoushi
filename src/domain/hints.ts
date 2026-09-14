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
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)]));
}

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
    if (s === "*" && !isFact) continue;
    const ok = (h: HintDef) => h.skillId === s && h.misconception === mc && h.level === level && (!h.kind || h.kind === p.kind);
    const h = HINTS.find((h) => ok(h) && h.step === step) ?? HINTS.find((h) => ok(h) && h.step === undefined);
    if (h) return h;
  }
  return undefined;
}

export function hintText(p: Problem, step: number, misconception: MisconceptionId | null, level: 1 | 2 | 3): { text: string; visual: HintVisual } | null {
  const h = findHint(p, step, misconception, level);
  if (!h) return null;
  return { text: fill(h.text, problemVars(p)), visual: h.visual ?? "none" };
}
