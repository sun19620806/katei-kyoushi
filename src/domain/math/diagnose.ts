import type { MisconceptionId, Problem } from "../types";

const ones = (n: number) => n % 10;
const tens = (n: number) => Math.floor(n / 10);

/**
 * 間違いの原因をルールで推定する。正解なら null、分からなければ "unknown"。
 * 順番に意味がある：具体的な間違い方を先に、うっかり（1ずれ）は最後に見る。
 */
export function diagnose(p: Problem, given: number): MisconceptionId | null {
  if (given === p.answer) return null;
  const { a, b } = p;

  if (p.kind === "add") {
    const onesSum = ones(a) + ones(b);
    if (a >= 10 || b >= 10) {
      if (given === (tens(a) + tens(b)) * 100 + onesSum) return "concat_ones";
      if (onesSum >= 10 && given === p.answer - 10) return "no_carry";
      if (Math.abs(given - p.answer) === 1) return "calc_slip";
    } else {
      if (given === p.answer - 10) return "no_carry";
      if (Math.abs(given - p.answer) === 1) return "count_slip";
    }
    return "unknown";
  }

  if (p.kind === "sub") {
    const smallerFromLarger = (tens(a) - tens(b)) * 10 + Math.abs(ones(a) - ones(b));
    if (given === smallerFromLarger) return "smaller_from_larger";
    if (given === p.answer + 10) return "borrow_no_decrement";
    if (Math.abs(given - p.answer) === 1) return "calc_slip";
    return "unknown";
  }

  // かけ算 a × b（a が段）
  if (given === a * (b - 1) || given === a * (b + 1)) return "neighbor_fact";
  if (a >= 3 && (given === (a - 1) * b || given === (a + 1) * b)) return "neighbor_dan";
  if (given === a + b) return "add_instead";
  return "unknown";
}
