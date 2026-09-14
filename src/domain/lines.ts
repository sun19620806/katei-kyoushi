import { LINES } from "./content";
import { fill } from "./hints";
import type { Rng } from "./random";

export interface PickedLine {
  key: string; // `${lineId}#${variant}` 使った記録に使う
  display: string;
  speech: string;
}

/**
 * 場面に合うセリフを選ぶ。
 * - needs の変数がそろっている行だけ
 * - 最近使った言い方(recent)は避ける。全部使っていたら避けない
 * speechVars は読み上げ用の値（名前の読みがななど）で display 用の値を上書きする。
 */
export function pickLine(
  scene: string,
  vars: Record<string, string | undefined>,
  recent: string[],
  rng: Rng,
  speechVars: Record<string, string | undefined> = {},
): PickedLine | null {
  const has = (k: string) => vars[k] !== undefined && vars[k] !== "";
  const options = LINES.filter((l) => l.scene === scene && (l.needs ?? []).every(has)).flatMap((l) =>
    l.variants.map((text, i) => ({ key: `${l.id}#${i}`, text })),
  );
  if (options.length === 0) return null;
  const recentSet = new Set(recent);
  const fresh = options.filter((o) => !recentSet.has(o.key));
  const pool = fresh.length > 0 ? fresh : options;
  const chosen = pool[Math.floor(rng() * pool.length)];
  const clean = (v: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => e[1] !== undefined));
  return {
    key: chosen.key,
    display: fill(chosen.text, clean(vars)),
    speech: fill(chosen.text, { ...clean(vars), ...clean(speechVars) }),
  };
}
