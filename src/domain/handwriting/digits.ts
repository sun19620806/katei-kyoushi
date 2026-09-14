// 手書き数字（0〜9）の認識。通信なし・モデルファイルなし。
// 組み込みのお手本（下の VARIANTS）と子どもが確定した字（extraTemplates）を $P で照合する。
import { makeTemplate, recognize, type Template } from "./pdollar";

type XY = { x: number; y: number };

/** これより小さい字（外枠の対角線, px）は「点・うっかりタッチ」とみなして読まない。
 *  入力は CSS px、1 マス 100〜300px 程度を想定。 */
export const MIN_DIAGONAL_PX = 8;
/** 1 画で 幅/高さ がこれ未満なら、細い縦線＝「1」とする（等倍縮小だと線がつぶれて照合が不安定なため） */
export const THIN_ASPECT = 0.25;

// ---- お手本を作る小道具（単位の箱、y は下向き） ----

const STEP = 0.02;

function line(x0: number, y0: number, x1: number, y1: number): XY[] {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / STEP) + 1);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  });
}

/** 楕円の弧。角度は度、0 = 右、90 = 下（画面座標なので時計回りに増える） */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): XY[] {
  const len = (Math.abs(a1 - a0) * Math.PI) / 180 * Math.max(rx, ry);
  const n = Math.max(3, Math.ceil(len / STEP) + 1);
  return Array.from({ length: n }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** 通過点を結ぶなめらかな曲線（Catmull-Rom） */
function spline(ctrl: [number, number][]): XY[] {
  const p = ctrl.map(([x, y]) => ({ x, y }));
  const out: XY[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const n = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / STEP));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

/** 部品をつないで 1 画にする */
function join(...parts: XY[][]): XY[] {
  const out: XY[] = [];
  for (const part of parts) {
    for (const q of part) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(last.x - q.x, last.y - q.y) > 1e-6) out.push(q);
    }
  }
  return out;
}

// ---- お手本（日本の子どもの書き方を中心に） ----

export interface DigitVariant {
  digit: number;
  label: string;
  strokes: XY[][];
}

const twoTop: [number, number][] = [[0.05, 0.25], [0.3, 0.0], [0.56, 0.2], [0.45, 0.5]];
const fiveBump: [number, number][] = [[0.06, 0.45], [0.35, 0.36], [0.6, 0.55], [0.56, 0.85], [0.3, 1.0], [0.02, 0.9]];

export const VARIANTS: DigitVariant[] = [
  // 0：上から書き始める楕円
  { digit: 0, label: "0 楕円", strokes: [arc(0.3, 0.5, 0.3, 0.5, -90, -450)] },
  { digit: 0, label: "0 まるい", strokes: [arc(0.4, 0.5, 0.4, 0.5, -90, -450)] },
  { digit: 0, label: "0 細め・重なり", strokes: [arc(0.22, 0.5, 0.22, 0.5, -70, -450)] },

  // 1
  { digit: 1, label: "1 縦線", strokes: [line(0.5, 0, 0.5, 1)] },
  { digit: 1, label: "1 はね", strokes: [join(line(0.2, 0.22, 0.45, 0), line(0.45, 0, 0.45, 1))] },
  { digit: 1, label: "1 台つき", strokes: [line(0.35, 0, 0.35, 1), line(0.05, 1, 0.65, 1)] },
  { digit: 1, label: "1 はね＋台", strokes: [join(line(0.1, 0.22, 0.35, 0), line(0.35, 0, 0.35, 1)), line(0.05, 1, 0.65, 1)] },

  // 2
  { digit: 2, label: "2 平らな底", strokes: [join(spline([...twoTop, [0.0, 1.0]]), line(0, 1, 0.65, 1))] },
  {
    digit: 2,
    label: "2 左下に輪",
    strokes: [join(spline([...twoTop, [0.2, 0.82], [0.1, 0.97], [0.02, 0.9], [0.07, 0.8], [0.18, 0.9], [0.3, 1.0]]), line(0.3, 1, 0.68, 1))],
  },

  // 3
  {
    digit: 3,
    label: "3 ふたこぶ",
    strokes: [join(
      spline([[0.05, 0.13], [0.3, 0.0], [0.55, 0.14], [0.5, 0.38], [0.24, 0.48]]),
      spline([[0.24, 0.48], [0.55, 0.6], [0.6, 0.8], [0.35, 1.0], [0.04, 0.9]]),
    )],
  },
  {
    digit: 3,
    label: "3 上が平ら",
    strokes: [join(line(0.05, 0, 0.58, 0), line(0.58, 0, 0.25, 0.4), spline([[0.25, 0.4], [0.55, 0.52], [0.62, 0.78], [0.36, 1.0], [0.04, 0.9]]))],
  },

  // 4
  { digit: 4, label: "4 開き・斜め", strokes: [join(line(0.42, 0, 0, 0.7), line(0, 0.7, 0.72, 0.7)), line(0.5, 0.25, 0.5, 1)] },
  { digit: 4, label: "4 開き・縦", strokes: [join(line(0.12, 0, 0.04, 0.68), line(0.04, 0.68, 0.72, 0.68)), line(0.5, 0.05, 0.5, 1)] },
  { digit: 4, label: "4 閉じ・一筆", strokes: [join(line(0.72, 0.7, 0, 0.7), line(0, 0.7, 0.5, 0), line(0.5, 0, 0.5, 1))] },

  // 5
  { digit: 5, label: "5 二画", strokes: [join(line(0.1, 0, 0.06, 0.45), spline(fiveBump)), line(0.1, 0, 0.62, 0)] },
  { digit: 5, label: "5 一筆", strokes: [join(line(0.62, 0, 0.1, 0), line(0.1, 0, 0.06, 0.45), spline(fiveBump))] },

  // 6
  {
    digit: 6,
    label: "6 一筆",
    strokes: [spline([[0.5, 0.0], [0.2, 0.2], [0.04, 0.6], [0.1, 0.92], [0.33, 1.0], [0.55, 0.82], [0.46, 0.56], [0.2, 0.55], [0.05, 0.72]])],
  },
  {
    digit: 6,
    label: "6 まっすぐ上",
    strokes: [join(line(0.45, 0, 0.08, 0.62), spline([[0.08, 0.62], [0.12, 0.93], [0.34, 1.0], [0.56, 0.82], [0.46, 0.57], [0.22, 0.56], [0.08, 0.68]]))],
  },

  // 7
  { digit: 7, label: "7 一筆", strokes: [join(line(0, 0, 0.62, 0), line(0.62, 0, 0.25, 1))] },
  { digit: 7, label: "7 縦に下ろす", strokes: [join(line(0, 0, 0.58, 0), line(0.58, 0, 0.5, 1))] },
  { digit: 7, label: "7 左にはね", strokes: [join(line(0, 0.22, 0, 0), line(0, 0, 0.62, 0), line(0.62, 0, 0.3, 1))] },
  { digit: 7, label: "7 横棒つき", strokes: [join(line(0, 0, 0.62, 0), line(0.62, 0, 0.25, 1)), line(0.2, 0.5, 0.62, 0.5)] },

  // 8
  {
    digit: 8,
    label: "8 一筆",
    strokes: [join(arc(0.3, 0.24, 0.23, 0.24, -90, -270), arc(0.3, 0.74, 0.3, 0.26, -90, 270), arc(0.3, 0.24, 0.23, 0.24, 90, -90))],
  },
  { digit: 8, label: "8 まる二つ", strokes: [arc(0.3, 0.24, 0.23, 0.24, -90, -450), arc(0.3, 0.74, 0.3, 0.26, -90, 270)] },

  // 9
  { digit: 9, label: "9 まる＋棒", strokes: [arc(0.28, 0.25, 0.27, 0.25, 0, -360), line(0.55, 0.15, 0.52, 1)] },
  { digit: 9, label: "9 一筆", strokes: [join(arc(0.28, 0.25, 0.27, 0.25, 0, -360), line(0.55, 0.25, 0.5, 1))] },
];

const BUILTIN: Template[] = VARIANTS.map((v) => makeTemplate(String(v.digit), v.strokes));

export function recognizeDigit(
  strokes: XY[][],
  extraTemplates: Template[] = [],
): { digit: number | null; score: number; alternatives: number[] } {
  const live = strokes.filter((s) => s.length > 0);
  if (live.length === 0) return { digit: null, score: 0, alternatives: [] };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of live) {
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const w = maxX - minX, h = maxY - minY;
  if (Math.hypot(w, h) < MIN_DIAGONAL_PX) return { digit: null, score: 0, alternatives: [] };

  const extras = extraTemplates.filter((t) => /^[0-9]$/.test(t.name));
  const { ranked, score } = recognize(live, [...BUILTIN, ...extras]);
  const digits = ranked.map((r) => Number(r.name));

  if (live.length === 1 && h > 0 && w / h < THIN_ASPECT) {
    return { digit: 1, score: 1, alternatives: digits.filter((d) => d !== 1).slice(0, 2) };
  }
  if (digits.length === 0) return { digit: null, score: 0, alternatives: [] };
  return { digit: digits[0], score, alternatives: digits.slice(1, 3) };
}
