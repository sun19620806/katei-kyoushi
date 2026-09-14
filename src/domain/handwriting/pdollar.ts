// $P 点群認識（Vatavu, Anthony, Wobbrock 2012）を自前で実装したもの。
// 書き順・画の向き・画数に左右されない。回転には対応しない（数字は回すと別の字になるため）。

export interface Pt {
  x: number;
  y: number;
  id: number; // 何画目か
}

export interface Template {
  name: string;
  points: Pt[]; // normalize 済み
}

type XY = { x: number; y: number };

/** 1 つの字をならす点の数 */
export const N = 32;
/** 探索の開始点をずらす幅 = floor(N^(1-ε)) */
const EPSILON = 0.5;

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

/** 手ぶれ除去の間引き幅（字の外枠の対角線に対する割合）。原典の $P にはない前処理 */
const DENOISE = 0.05;

/** 細かいぶれで線の長さが水増しされ、打ち直しの点が偏るのを防ぐ。
 *  直前に残した点から一定距離未満の点を捨て、残りを軽くならす（お手本と入力に同じ処理をかける） */
function toPoints(strokes: XY[][]): Pt[] {
  const clean = strokes.map((s) => s.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of clean) {
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const gap = DENOISE * Math.hypot(maxX - minX, maxY - minY);
  const pts: Pt[] = [];
  clean.forEach((s, id) => {
    if (s.length === 0) return;
    const kept: XY[] = [s[0]];
    for (let i = 1; i < s.length; i++) {
      if (dist(kept[kept.length - 1], s[i]) >= gap) kept.push(s[i]);
    }
    const last = s[s.length - 1];
    if (kept.length > 1 && dist(kept[kept.length - 1], last) < gap) kept[kept.length - 1] = last;
    else if (kept[kept.length - 1] !== last) kept.push(last);
    for (let i = 0; i < kept.length; i++) {
      if (i === 0 || i === kept.length - 1) pts.push({ x: kept[i].x, y: kept[i].y, id });
      else
        pts.push({
          x: (kept[i - 1].x + 2 * kept[i].x + kept[i + 1].x) / 4,
          y: (kept[i - 1].y + 2 * kept[i].y + kept[i + 1].y) / 4,
          id,
        });
    }
  });
  return pts;
}

/** 全画をまとめて、画の中の長さに沿って n 点に等間隔で打ち直す（画と画の間の移動は数えない） */
function resample(points: Pt[], n: number): Pt[] {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].id === points[i - 1].id) total += dist(points[i - 1], points[i]);
  }
  if (total === 0) {
    // 点だけの入力：同じ点を並べる
    return Array.from({ length: n }, () => ({ ...points[0] }));
  }
  const step = total / (n - 1);
  const src = points.map((p) => ({ ...p }));
  const out: Pt[] = [{ ...src[0] }];
  let acc = 0;
  for (let i = 1; i < src.length && out.length < n; i++) {
    if (src[i].id !== src[i - 1].id) continue;
    const d = dist(src[i - 1], src[i]);
    if (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const q: Pt = {
        x: src[i - 1].x + t * (src[i].x - src[i - 1].x),
        y: src[i - 1].y + t * (src[i].y - src[i - 1].y),
        id: src[i].id,
      };
      out.push(q);
      src.splice(i, 0, q); // q を次の始点にする
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) {
    const last = src[src.length - 1];
    out.push({ ...last });
  }
  return out;
}

/** 縦横比を保ったまま大きさ 1 にそろえる */
function scale(points: Pt[]): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  return points.map((p) => ({ x: (p.x - minX) / size, y: (p.y - minY) / size, id: p.id }));
}

/** 重心を原点へ */
function translateToOrigin(points: Pt[]): Pt[] {
  let cx = 0, cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  return points.map((p) => ({ x: p.x - cx, y: p.y - cy, id: p.id }));
}

export function normalize(strokes: XY[][]): Pt[] {
  const pts = toPoints(strokes);
  if (pts.length === 0) return [];
  return translateToOrigin(scale(resample(pts, N)));
}

export function makeTemplate(name: string, strokes: XY[][]): Template {
  return { name, points: normalize(strokes) };
}

/** a の各点を start から順に、まだ使っていない b の最近点と組ませる。先に組む点ほど重い。bound を超えたら打ち切る */
function cloudDistance(a: Float64Array, b: Float64Array, start: number, bound: number, used: Uint8Array): number {
  const n = a.length / 2;
  used.fill(0);
  let sum = 0;
  let i = start;
  let k = 0;
  do {
    let best = Infinity;
    let bestJ = -1;
    const ax = a[2 * i], ay = a[2 * i + 1];
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const dx = ax - b[2 * j], dy = ay - b[2 * j + 1];
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        bestJ = j;
      }
    }
    used[bestJ] = 1;
    sum += (1 - k / n) * Math.sqrt(best);
    if (sum >= bound) return sum;
    k++;
    i = (i + 1) % n;
  } while (i !== start);
  return sum;
}

// 速さのため座標を平たい配列にしておく（お手本ごとに 1 回だけ）
const flatCache = new WeakMap<Pt[], Float64Array>();
function flat(points: Pt[]): Float64Array {
  let f = flatCache.get(points);
  if (!f) {
    f = new Float64Array(points.length * 2);
    points.forEach((p, i) => {
      f![2 * i] = p.x;
      f![2 * i + 1] = p.y;
    });
    flatCache.set(points, f);
  }
  return f;
}

function greedyCloudMatch(points: Float64Array, tpl: Float64Array, bound: number): number {
  const n = points.length / 2;
  const step = Math.floor(Math.pow(n, 1 - EPSILON));
  const used = new Uint8Array(n);
  let min = bound;
  for (let i = 0; i < n; i += step) {
    min = Math.min(min, cloudDistance(points, tpl, i, min, used));
    min = Math.min(min, cloudDistance(tpl, points, i, min, used));
  }
  return min;
}

/** 距離 → 0..1 の目安。score = max(0, (2 - 距離) / 2)。
 *  距離は正規化後（大きさ 1）の重み付き点間距離の合計。お手本そのものなら 1、
 *  ふつうの手書きで 0.4〜0.8、2 以上離れると 0。 */
export function distanceToScore(d: number): number {
  return Math.max(0, (2 - d) / 2);
}

export function recognize(
  strokes: XY[][],
  templates: Template[],
): { name: string; score: number; ranked: { name: string; distance: number }[] } {
  const pts = normalize(strokes);
  if (pts.length === 0 || templates.length === 0) return { name: "", score: 0, ranked: [] };
  const input = flat(pts);
  const bestByName = new Map<string, number>();
  for (const t of templates) {
    if (t.points.length !== pts.length) continue;
    // 同じ名前のより良い候補がすでにあれば、それを上限に打ち切ってよい
    const bound = bestByName.get(t.name) ?? Infinity;
    const d = greedyCloudMatch(input, flat(t.points), bound);
    if (d < bound) bestByName.set(t.name, d);
  }
  const ranked = [...bestByName].map(([name, distance]) => ({ name, distance })).sort((a, b) => a.distance - b.distance);
  if (ranked.length === 0) return { name: "", score: 0, ranked };
  return { name: ranked[0].name, score: distanceToScore(ranked[0].distance), ranked };
}
