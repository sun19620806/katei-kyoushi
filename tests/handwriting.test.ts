import { describe, expect, it } from "vitest";
import { MIN_DIAGONAL_PX, recognizeDigit, VARIANTS } from "../src/domain/handwriting/digits";
import { makeTemplate } from "../src/domain/handwriting/pdollar";
import { seededRng, type Rng } from "../src/domain/random";

type XY = { x: number; y: number };

const uni = (rng: Rng, a: number, b: number) => a + (b - a) * rng();

/** 画を長さに沿って k 点に打ち直す。gamma で書く速さのむらをまねる */
function resampleRaw(s: XY[], k: number, gamma: number): XY[] {
  const cum = [0];
  for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  const total = cum[cum.length - 1];
  const out: XY[] = [];
  let j = 1;
  for (let i = 0; i < k; i++) {
    const target = Math.pow(i / (k - 1), gamma) * total;
    while (j < s.length - 1 && cum[j] < target) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const t = Math.min(1, Math.max(0, (target - cum[j - 1]) / seg));
    out.push({ x: s[j - 1].x + (s[j].x - s[j - 1].x) * t, y: s[j - 1].y + (s[j].y - s[j - 1].y) * t });
  }
  return out;
}

/** お手本（単位の箱）を、ばらつきのある「px の手書き」に変える */
function distort(strokes: XY[][], rng: Rng): XY[][] {
  const base = 150;
  const sx = uni(rng, 0.6, 1.6);
  const sy = Math.min(1.6, Math.max(0.6, sx * uni(rng, 0.75, 1.25)));
  const th = (uni(rng, -12, 12) * Math.PI) / 180;
  const size = base * Math.max(sx, sy);
  const jit = 0.03 * size;
  const ox = uni(rng, 0, 300), oy = uni(rng, 0, 300);
  const out = strokes.map((s) => {
    let pts = resampleRaw(s, Math.floor(uni(rng, 15, 81)), uni(rng, 0.7, 1.4));
    if (rng() < 0.3) pts = pts.reverse();
    return pts.map((p) => {
      const x = (p.x - 0.3) * sx * base, y = (p.y - 0.5) * sy * base;
      return {
        x: ox + x * Math.cos(th) - y * Math.sin(th) + uni(rng, -jit, jit),
        y: oy + x * Math.sin(th) + y * Math.cos(th) + uni(rng, -jit, jit),
      };
    });
  });
  if (rng() < 0.3) out.reverse();
  return out;
}

// ---- 手で作る「子どもっぽい」字（px） ----

function quad(a: XY, c: XY, b: XY, n = 30): XY[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  });
}
const seg = (a: XY, b: XY, n = 20) => quad(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b, n);
const P = (x: number, y: number): XY => ({ x, y });
/** 楕円（度、0 = 右、90 = 下）。r に揺れを足せる */
function ellipse(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, wobble = (_: number) => 0, n = 60): XY[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
    const k = 1 + wobble(a);
    return { x: cx + rx * k * Math.cos(a), y: cy + ry * k * Math.sin(a) };
  });
}

describe("手書き数字の認識", () => {
  it("お手本をゆがめた字をほぼ正しく読める", () => {
    const rng = seededRng(20260915);
    const SAMPLES = 20;
    const hit = new Map<number, number>();
    const all = new Map<number, number>();
    const confusions = new Map<string, number>();
    for (const v of VARIANTS) {
      for (let i = 0; i < SAMPLES; i++) {
        const r = recognizeDigit(distort(v.strokes, rng));
        all.set(v.digit, (all.get(v.digit) ?? 0) + 1);
        if (r.digit === v.digit) hit.set(v.digit, (hit.get(v.digit) ?? 0) + 1);
        else confusions.set(`${v.label}→${r.digit}`, (confusions.get(`${v.label}→${r.digit}`) ?? 0) + 1);
      }
    }
    const total = [...all.values()].reduce((a, b) => a + b, 0);
    const good = [...hit.values()].reduce((a, b) => a + b, 0);
    const perDigit = [...all].map(([d, n]) => [d, (hit.get(d) ?? 0) / n] as const);
    console.info(
      `全体 ${((good / total) * 100).toFixed(1)}% (${good}/${total}) / ` +
        perDigit.map(([d, a]) => `${d}:${(a * 100).toFixed(0)}%`).join(" ") +
        ` / 取り違え ${JSON.stringify(Object.fromEntries(confusions))}`,
    );
    expect(good / total).toBeGreaterThanOrEqual(0.95);
    for (const [d, a] of perDigit) expect(a, `数字 ${d}`).toBeGreaterThanOrEqual(0.88);
  });

  it("お手本と違う、子どもらしい字も読める", () => {
    const cases: [number, XY[][]][] = [
      // 縦棒が少し曲がった 7
      [7, [[...seg(P(20, 30), P(110, 26)), ...quad(P(110, 26), P(68, 95), P(64, 172))]]],
      // 大きく傾いた 1（細線の近道には入らず、照合で読む）
      [1, [seg(P(100, 20), P(55, 180))]],
      // 一筆の 4（角が丸く、縦棒が少し傾く）
      [4, [[...seg(P(100, 190), P(104, 40)), ...quad(P(104, 40), P(100, 22), P(90, 38)), ...seg(P(90, 38), P(24, 120)), ...quad(P(24, 120), P(18, 130), P(34, 128)), ...seg(P(34, 128), P(138, 122))]]],
      // まるが閉じていない 9
      [9, [ellipse(60, 55, 42, 40, -40, -290), seg(P(104, 40), P(98, 190))]],
      // ぐにゃっとした 0
      [0, [ellipse(70, 100, 48, 85, -95, -470, (a) => 0.07 * Math.sin(5 * a) + 0.04 * Math.sin(3 * a))]],
      // 底が丸い 2
      [2, [[...quad(P(22, 55), P(60, -20), P(100, 50)), ...quad(P(100, 50), P(80, 100), P(24, 160)), ...quad(P(24, 160), P(60, 150), P(116, 164))]]],
      // 下のこぶが大きい 3
      [3, [[...quad(P(20, 30), P(95, -10), P(62, 60)), ...quad(P(62, 60), P(50, 70), P(40, 72)), ...quad(P(40, 72), P(150, 90), P(90, 165)), ...quad(P(90, 165), P(50, 190), P(15, 160))]]],
      // 上のまるが小さい 8（二画）
      [8, [ellipse(70, 45, 28, 32, -90, 270), ellipse(70, 125, 45, 48, -90, -450)]],
      // 横棒が斜めで、あとから書く 5
      [5, [[...seg(P(30, 20), P(24, 80)), ...quad(P(24, 80), P(130, 50), P(110, 130)), ...quad(P(110, 130), P(80, 185), P(15, 160))], seg(P(30, 22), P(115, 10))]],
      // 輪が小さい 6
      [6, [[...quad(P(95, 10), P(20, 60), P(30, 160)), ...ellipse(58, 142, 30, 28, 180, -180)]]],
    ];
    for (const [digit, strokes] of cases) {
      expect(recognizeDigit(strokes).digit, `期待 ${digit}`).toBe(digit);
    }
  });

  it("細い縦線は 1、空と小さな点は読まない", () => {
    const r = recognizeDigit([seg(P(100, 20), P(104, 180))]);
    expect(r.digit).toBe(1);
    expect(r.alternatives).toHaveLength(2);
    expect(recognizeDigit([])).toEqual({ digit: null, score: 0, alternatives: [] });
    expect(recognizeDigit([[]]).digit).toBeNull();
    expect(recognizeDigit([[P(50, 50), P(52, 51), P(51, 53)]]).digit).toBeNull();
    expect(recognizeDigit([[P(50, 50)]]).digit).toBeNull();
    // しきい値より少し大きければ読む
    expect(recognizeDigit([seg(P(50, 50), P(50 + MIN_DIAGONAL_PX, 50 + MIN_DIAGONAL_PX * 3))]).digit).not.toBeNull();
  });

  it("score は 0..1、候補は正解以外の 2 つ", () => {
    const v = VARIANTS.find((x) => x.digit === 3)!;
    const r = recognizeDigit(distort(v.strokes, seededRng(7)));
    expect(r.digit).toBe(3);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.alternatives).toHaveLength(2);
    expect(r.alternatives).not.toContain(3);
  });

  it("子どもの字をお手本に足すと、変わった形の 2 も読める", () => {
    // 角ばった上の横棒から、途中で一度右に折れて左下へ流れる、底のない変わった 2
    const odd = (dx: number, dy: number, k: number): XY[][] => [
      [...seg(P(10 + dx, 40 + dy), P(20 + dx, 10 + dy)), ...seg(P(20 + dx, 10 + dy), P(120 * k + dx, 12 + dy)), ...seg(P(120 * k + dx, 12 + dy), P(60 * k + dx, 90 + dy)), ...seg(P(60 * k + dx, 90 + dy), P(130 * k + dx, 100 + dy)), ...seg(P(130 * k + dx, 100 + dy), P(15 + dx, 170 + dy))],
    ];
    expect(recognizeDigit(odd(0, 0, 1)).digit).not.toBe(2);
    const mine = makeTemplate("2", odd(0, 0, 1));
    // 位置や大きさが少し違う同じ書き方でも読める
    expect(recognizeDigit(odd(40, 25, 1.1), [mine]).digit).toBe(2);
    // ほかの字の読みはこわれない
    expect(recognizeDigit(distort(VARIANTS.find((x) => x.digit === 7)!.strokes, seededRng(3)), [mine]).digit).toBe(7);
  });
});
