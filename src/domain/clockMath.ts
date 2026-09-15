/**
 * とけいの はりを 指で うごかした ときの 計算（画面から 切りはなして テストする）。
 * 角度は 12時の 方向を 0度として 時計回り。
 */

const circDist = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

/** ながい はりの 角度 → 分（5分きざみ） */
export const minuteFromAngle = (angle: number) => (Math.round((((angle % 360) + 360) % 360) / 30) * 5) % 60;

/**
 * みじかい はりの 角度 → 時。
 * 正しい はりの 位置は「時の すうじ」から「分の ぶん すすんだ ところ」までの あいだ。
 * 指が その あいだに いちばん 近い 時を えらぶ（すうじの 上に おいても、少し すすめて おいても 正解に なる）。
 */
export function hourFromAngle(angle: number, minute: number): number {
  let best = 12;
  let bestDist = Infinity;
  for (let h = 1; h <= 12; h++) {
    const from = (h % 12) * 30;
    const to = from + minute / 2;
    const inside = circDist(angle, from) + circDist(angle, to) <= minute / 2 + 0.001;
    // すうじの 手前がわ（前の 時の ほう）に ずれて いる ときは 少し 遠く 見なす（すすみすぎより 起こりにくい ため）
    const before = (((angle - from) % 360) + 360) % 360 > 180;
    const dist = inside ? 0 : Math.min(circDist(angle, from) * (before ? 1.5 : 1), circDist(angle, to));
    if (dist < bestDist) {
      bestDist = dist;
      best = h;
    }
  }
  return best;
}

/** はりの 角度（表示用） */
export const hourHandAngle = (h: number, m: number) => ((h % 12) + m / 60) * 30;
export const minuteHandAngle = (m: number) => m * 6;

/**
 * さわった 場所から、どちらの はりを うごかすか。
 * 角度の 近さを 基本に、中心に 近ければ みじかい はり、外がわなら ながい はりを えらびやすくする。
 */
export function pickHand(touchAngle: number, distRatio: number, h: number, m: number): "hour" | "minute" {
  const hourScore = circDist(touchAngle, hourHandAngle(h, m)) + (distRatio > 0.62 ? 40 : 0);
  const minuteScore = circDist(touchAngle, minuteHandAngle(m)) + (distRatio < 0.4 ? 40 : 0);
  return hourScore < minuteScore ? "hour" : "minute";
}
