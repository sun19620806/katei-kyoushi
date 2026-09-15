/** やさしい 効果音（Web Audio で その場で つくる。音声ファイルは いらない） */
let ctx: AudioContext | null = null;
let enabled = true;

export function configureSound(on: boolean) {
  enabled = on;
}

function audio() {
  if (!enabled || typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(freq: number, start: number, length: number, volume = 0.12, type: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

/** せいかい：ピンポン */
export function playCorrect() {
  tone(880, 0, 0.18);
  tone(1318.5, 0.12, 0.32);
}

/** シール：キラリン */
export function playSticker() {
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, i * 0.08, 0.35, 0.08, "triangle"));
}

/** タップ：ぽん（とても 小さく） */
export function playTap() {
  tone(660, 0, 0.06, 0.04);
}
