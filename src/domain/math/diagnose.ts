import type { MisconceptionId, Problem } from "../types";

export const digit = (n: number, place: 1 | 10 | 100) => Math.floor(n / place) % 10;

/** 各位で「大きいほうから小さいほうを引く」間違い */
export function digitwiseAbsDiff(a: number, b: number): number {
  return [100, 10, 1].reduce((sum, place) => sum + Math.abs(digit(a, place as 1 | 10 | 100) - digit(b, place as 1 | 10 | 100)) * place, 0);
}

export const exprText = {
  mul: (x: number, y: number) => `${x} × ${y}`,
  add: (x: number, y: number) => `${x} + ${y}`,
};

/**
 * 間違いの原因をルールで推定する。正解なら null、分からなければ "unknown"。
 * 順番に意味がある：具体的な間違い方を先に、うっかり（1ずれ）は最後に見る。
 */
export function diagnose(p: Problem, step: number, given: number): MisconceptionId | null {
  const s = p.steps[step];
  if (given === s.answer) return null;
  const { a, b } = p;

  switch (p.kind) {
    case "add": {
      const onesSum = digit(a, 1) + digit(b, 1);
      if (a >= 10 || b >= 10) {
        if (onesSum >= 10 && given === (digit(a, 10) + digit(b, 10)) * 100 + onesSum) return "concat_ones";
        if ([10, 100, 110].includes(p.answer - given)) return "no_carry";
        if (Math.abs(given - p.answer) === 1) return "calc_slip";
      } else {
        if (given === p.answer - 10) return "no_carry";
        if (Math.abs(given - p.answer) === 1) return "count_slip";
      }
      return "unknown";
    }
    case "sub": {
      if (given === digitwiseAbsDiff(a, b)) return "smaller_from_larger";
      if ([10, 100, 110].includes(given - p.answer)) return "borrow_no_decrement";
      if (Math.abs(given - p.answer) === 1) return "calc_slip";
      return "unknown";
    }
    case "mul":
      return diagnoseFact(a, b, given);
    case "mul_word": {
      if (step === 0) {
        const chosen = s.choices?.[given];
        if (chosen === exprText.mul(b, a)) return "order_reversed";
        if (chosen === exprText.add(a, b)) return "add_instead";
        return "unknown";
      }
      return diagnoseFact(a, b, given);
    }
    case "mul_missing": {
      if (given === (p.product ?? 0) - a) return "product_minus";
      if (Math.abs(given - b) === 1) return "neighbor_fact";
      return "unknown";
    }
    case "len_to_cm":
      if (given === a * 10 + b) return "m_as_10cm";
      return "unknown";
    case "len_to_mcm":
      if (given === p.cm) return "cm_whole";
      if (given === (p.cm ?? 0) - a * 10) return "m_as_10cm";
      return "unknown";
  }
}

/** 九九 a × b の間違い */
function diagnoseFact(a: number, b: number, given: number): MisconceptionId {
  if (given === a * (b - 1) || given === a * (b + 1)) return "neighbor_fact";
  if (a >= 3 && (given === (a - 1) * b || given === (a + 1) * b)) return "neighbor_dan";
  if (given === a + b) return "add_instead";
  return "unknown";
}

/**
 * 間違い方をまねした答え（その間違い方がこの問題で起こりえないときは null）。
 * 生成器が「間違い方ごとに答えが違う問題」だけを出すための確認と、テストに使う。
 */
export function simulateWrong(p: Problem, step: number, mc: MisconceptionId): number | null {
  const { a, b } = p;
  const s = p.steps[step];
  const choiceIndex = (text: string) => {
    const i = s.choices?.indexOf(text) ?? -1;
    return i >= 0 ? i : null;
  };
  switch (p.kind) {
    case "add": {
      const onesSum = digit(a, 1) + digit(b, 1);
      if (mc === "no_carry") return onesSum >= 10 ? p.answer - 10 : null;
      if (mc === "concat_ones") return a >= 10 && onesSum >= 10 ? (digit(a, 10) + digit(b, 10)) * 100 + onesSum : null;
      if (mc === "calc_slip" || mc === "count_slip") return p.answer + 1;
      return null;
    }
    case "sub": {
      if (mc === "smaller_from_larger") return digitwiseAbsDiff(a, b);
      if (mc === "borrow_no_decrement") return forgetDecrement(a, b);
      if (mc === "calc_slip") return p.answer + 1;
      return null;
    }
    case "mul":
      return simulateFact(a, b, mc);
    case "mul_word":
      if (step === 0) {
        if (mc === "order_reversed") return choiceIndex(exprText.mul(b, a));
        if (mc === "add_instead") return choiceIndex(exprText.add(a, b));
        return null;
      }
      return mc === "order_reversed" ? null : simulateFact(a, b, mc);
    case "mul_missing":
      if (mc === "product_minus") return (p.product ?? 0) - a;
      if (mc === "neighbor_fact") return b + 1;
      return null;
    case "len_to_cm":
      return mc === "m_as_10cm" ? a * 10 + b : null;
    case "len_to_mcm":
      if (mc === "cm_whole") return p.cm ?? null;
      if (mc === "m_as_10cm") return (p.cm ?? 0) - a * 10;
      return null;
  }
}

function simulateFact(a: number, b: number, mc: MisconceptionId): number | null {
  if (mc === "neighbor_fact") return a * (b + 1);
  if (mc === "neighbor_dan") return a >= 3 ? (a + 1) * b : null;
  if (mc === "add_instead") return a + b;
  return null;
}

/** くり下がりで、借りた位を減らし忘れた筆算 */
function forgetDecrement(a: number, b: number): number {
  let result = 0;
  for (const place of [1, 10, 100] as const) {
    const top = digit(a, place);
    const bottom = digit(b, place);
    result += (top < bottom ? top + 10 - bottom : top - bottom) * place;
  }
  return result;
}
