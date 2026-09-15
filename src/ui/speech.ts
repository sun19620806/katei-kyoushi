import { toSpeakable } from "../domain/speechText";

/** iPad 内蔵の読み上げ（Web Speech API）。無料・オフラインで動く */

let voice: SpeechSynthesisVoice | null = null;
let enabled = true;
let rate = 1;

function chooseVoice() {
  if (typeof speechSynthesis === "undefined") return;
  const ja = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("ja"));
  // 高品質版（拡張・プレミアム）があれば優先
  voice =
    ja.find((v) => /premium|enhanced|拡張|プレミアム/i.test(v.name)) ??
    ja.find((v) => /kyoko|o-ren|hattori/i.test(v.name)) ??
    ja[0] ??
    null;
}

if (typeof speechSynthesis !== "undefined") {
  chooseVoice();
  speechSynthesis.addEventListener?.("voiceschanged", chooseVoice);
}

export function configureSpeech(opts: { enabled: boolean; rate: number }) {
  enabled = opts.enabled;
  rate = opts.rate;
}

let unlocked = false;

/** iPad の Safari は、さいしょの読み上げを タップの 中で しないと 声が 出ないので、タップの ときに よぶ */
export function unlockSpeech() {
  if (unlocked || typeof speechSynthesis === "undefined") return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function speak(text: string, onEnd?: () => void) {
  if (!enabled || typeof speechSynthesis === "undefined" || !text) {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(toSpeakable(text));
  u.lang = "ja-JP";
  if (voice) u.voice = voice;
  u.rate = rate;
  u.pitch = 1.05;
  if (onEnd) u.onend = () => onEnd();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
