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

  // 選択肢ごとに原因が決まっている問題（国語・図形・分数の図など）
  if (s.type === "choice" && s.choiceMcs) return s.choiceMcs[given] ?? "unknown";

  switch (p.kind) {
    case "add": {
      const onesSum = digit(a, 1) + digit(b, 1);
      if (a >= 100 && b < 100 && b >= 10 && given === a + b * 10) return "place_misalign";
      if (a >= 10 || b >= 10) {
        if (a < 100 && onesSum >= 10 && given === (digit(a, 10) + digit(b, 10)) * 100 + onesSum) return "concat_ones";
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
    default:
      return diagnoseByTable(p, step, given);
  }
}

/** 新しい種類の問題は「間違い方 → そのときの答え」の表で判定する（simulateWrong と同じ表） */
function diagnoseByTable(p: Problem, step: number, given: number): MisconceptionId {
  const rows = wrongTable(p, step);
  for (const [mc, value] of rows) if (value === given) return mc;
  if (rows.some(([mc]) => mc === "calc_slip") && Math.abs(given - p.steps[step].answer) === 1) return "calc_slip";
  return "unknown";
}

const wrongRatio = (r: number) => (r === 10 ? 100 : r === 100 ? 10 : 100);
const nextHour = (h: number) => (h % 12) + 1;

/** 時こくを d 分うごかす */
export function shiftTime(h: number, m: number, d: number): { h: number; m: number } {
  let total = (h % 12) * 60 + m + d;
  total = ((total % 720) + 720) % 720;
  const hh = Math.floor(total / 60);
  return { h: hh === 0 ? 12 : hh, m: total % 60 };
}

/** 問題の種類ごとの「間違い方 → そのときの答え」。起こりえない間違いは入れない。並び順＝判定の優先順 */
export function wrongTable(p: Problem, step: number): [MisconceptionId, number][] {
  const { a, b } = p;
  const rows: [MisconceptionId, number | null][] = [];
  switch (p.kind) {
    case "unit_to_small": {
      const r = p.unit!.ratio;
      rows.push(["ratio_wrong", a * wrongRatio(r) + b]);
      break;
    }
    case "unit_to_mixed": {
      const { ratio, total = 0 } = p.unit!;
      rows.push(["small_whole", total], ["ratio_wrong", total - a * wrongRatio(ratio)]);
      break;
    }
    case "clock_read": {
      const { h, m } = p.clock!;
      if (step === 0) {
        rows.push(["hands_swapped", m % 5 === 0 && m > 0 ? m / 5 : null], ["hour_ahead", m >= 30 ? nextHour(h) : null]);
      } else {
        rows.push(["minute_as_number", m % 5 === 0 && m > 0 ? m / 5 : null], ["hands_swapped", h * 5]);
      }
      break;
    }
    case "clock_shift": {
      const { h, m, shift = 0, dir = "after" } = p.clock!;
      const d = dir === "after" ? shift : -shift;
      const opposite = shiftTime(h, m, -d);
      if (dir === "after") {
        if (step === 0) rows.push(["no_hour_carry", h], ["before_after_mix", opposite.h]);
        else rows.push(["no_hour_carry", m + shift], ["before_after_mix", opposite.m]);
      } else {
        if (step === 0) rows.push(["no_hour_carry", h], ["before_after_mix", opposite.h]);
        else rows.push(["hour_as_100", m + 100 - shift], ["before_after_mix", opposite.m]);
      }
      break;
    }
    case "fraction_of":
      rows.push(["gave_denominator", b], ["used_half", b !== 2 && a % 2 === 0 ? a / 2 : null], ["subtracted", a - b]);
      break;
    case "addsub_word": {
      if (step === 0) break;
      const op = p.addsub!.op;
      const other = op === "add" ? a - b : a + b;
      rows.push(["op_reversed", other]);
      if (op === "add") {
        if (digit(a, 1) + digit(b, 1) >= 10) rows.push(["no_carry", p.answer - 10]);
      } else {
        rows.push(["smaller_from_larger", digitwiseAbsDiff(a, b)]);
        if (digit(a, 1) < digit(b, 1)) rows.push(["borrow_no_decrement", p.answer + 10]);
      }
      rows.push(["calc_slip", p.answer + 1]);
      break;
    }
    case "mul_rule":
      if (p.rule === "step") rows.push(["one_more", 1], ["gave_product", a * (b + 1)]);
      else rows.push(["gave_product", a * b], ["same_number", a]);
      break;
    case "place_compose": {
      const { thousands, hundreds, tens, ones } = p.place!;
      const nonZero = [thousands, hundreds, tens, ones].filter((x) => x !== 0).join("");
      rows.push(["zero_miss", Number(nonZero)]);
      break;
    }
  }
  return rows.filter((r): r is [MisconceptionId, number] => r[1] !== null && r[1] >= 0);
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
  if (s.type === "choice" && s.choiceMcs) {
    const i = s.choiceMcs.indexOf(mc);
    return i >= 0 ? i : null;
  }
  const choiceIndex = (text: string) => {
    const i = s.choices?.indexOf(text) ?? -1;
    return i >= 0 ? i : null;
  };
  switch (p.kind) {
    case "add": {
      const onesSum = digit(a, 1) + digit(b, 1);
      if (mc === "no_carry") return onesSum >= 10 ? p.answer - 10 : null;
      if (mc === "concat_ones") return a >= 10 && a < 100 && onesSum >= 10 ? (digit(a, 10) + digit(b, 10)) * 100 + onesSum : null;
      if (mc === "place_misalign") return a >= 100 && b >= 10 && b < 100 ? a + b * 10 : null;
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
    default:
      return wrongTable(p, step).find((r) => r[0] === mc)?.[1] ?? null;
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
