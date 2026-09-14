import { HINTS } from "./content";
import type { HintDef, MisconceptionId, Problem } from "./types";

/** 問題から、ヒント文に差し込む変数を作る */
export function problemVars(p: Problem): Record<string, string> {
  const a1 = p.a % 10;
  const a10 = Math.floor(p.a / 10);
  const b1 = p.b % 10;
  const b10 = Math.floor(p.b / 10);
  const onesSum = a1 + b1;
  const vars: Record<string, number> = {
    a: p.a,
    b: p.b,
    answer: p.answer,
    a1,
    a10,
    b1,
    b10,
    ones_sum: p.kind === "add" && p.a < 10 && p.b < 10 ? p.a + p.b : onesSum,
    ones_sum_minus10: (p.kind === "add" && p.a < 10 && p.b < 10 ? p.a + p.b : onesSum) - 10,
    a1_plus10: a1 + 10,
    a10_minus1: a10 - 1,
    n: p.a,
    m: p.b,
    m_minus1: p.b - 1,
    prev: p.a * (p.b - 1),
  };
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)]));
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/**
 * ヒントを選ぶ。優先順：
 * (スキル, 原因) → (スキル, *) → (*, 原因) → (*, *)
 */
export function findHint(p: Problem, misconception: MisconceptionId | null, level: 1 | 2 | 3): HintDef | undefined {
  const m = misconception && misconception !== "unknown" ? misconception : "*";
  const candidates: [string, string][] = [
    [p.skillId, m],
    [p.skillId, "*"],
    ["*", m],
    ["*", "*"],
  ];
  // 九九以外で (*, *) に落ちると九九のヒントになってしまうので、九九だけ共通ヒントを使う
  const allowShared = p.kind === "mul";
  for (const [s, mc] of candidates) {
    if (s === "*" && !allowShared) continue;
    const h = HINTS.find((h) => h.skillId === s && h.misconception === mc && h.level === level);
    if (h) return h;
  }
  return undefined;
}

export function hintText(p: Problem, misconception: MisconceptionId | null, level: 1 | 2 | 3) {
  const h = findHint(p, misconception, level);
  return h ? { text: fill(h.text, problemVars(p)), visual: h.visual ?? "none" } : null;
}
