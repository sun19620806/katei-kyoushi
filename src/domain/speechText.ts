import { load } from "js-yaml";
import readingsRaw from "../content/readings.yaml?raw";

const READINGS = Object.entries((load(readingsRaw) as { readings: Record<string, string> }).readings).sort(
  (a, b) => b[0].length - a[0].length,
);

/** 語のおわり（スペース・句読点・文末） */
const END = "(?=[\\s、。！？!?」）)…]|$)";

/**
 * 画面の文を、読み上げ用の文にする。
 *
 * 子ども向けの文は「こたえは なんcm？」のように分かち書きにしているため、
 * 読み上げエンジンが助詞をそのまま「ハ」「ヲ」と読んでしまう。そこで
 * 1. 漢字・記号の読みを置きかえる
 * 2. 語のおわりの「は」→「わ」、「を」→「お」、語のおわりの「へ」→「え」
 * 3. 分かち書きのスペースを詰める（区切りで不自然に止まらないように）
 */
export function toSpeakable(text: string): string {
  let s = text;
  for (const [from, to] of READINGS) s = s.split(from).join(to);
  s = s
    .replace(/(\d+)\/(\d+)/g, "$2ぶんの$1")
    .replace(/mL/g, "ミリリットル")
    .replace(/dL/g, "デシリットル")
    .replace(/mm/g, "ミリ")
    .replace(/(^|[^a-zA-Z])L(?![a-zA-Z])/g, "$1リットル")
    .replace(/cm/g, "センチ")
    .replace(/(^|[^a-zA-Z])m(?![a-zA-Z])/g, "$1メートル")
    .replace(/□/g, " しかく ")
    .replace(/×/g, " かける ")
    .replace(/[−-]/g, " ひく ")
    .replace(/\+/g, " たす ")
    .replace(/=/g, " わ ")
    .replace(new RegExp(`は${END}`, "g"), "わ")
    .replace(/を/g, "お")
    .replace(new RegExp(`へ${END}`, "g"), "え");
  // 日本語どうしの間のスペースは詰める。数字の前後は読みやすいように残す
  s = s.replace(/([^\x00-\x7F])[ 　]+(?=[^\x00-\x7F])/g, "$1");
  return s.replace(/[ 　]+/g, " ").trim();
}
