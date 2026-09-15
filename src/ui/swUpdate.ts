import { registerSW } from "virtual:pwa-register";

/**
 * 新しい版が届いたら、授業中ではないとき（ホームなど）にだけ入れかえる。
 * 授業のとちゅうで ページが 読みこみ直されないように する。
 */
let pending = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
let safe = true;

export function initUpdates() {
  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      pending = true;
      if (safe) void apply?.(true);
    },
  });
  // ときどき新しい版をさがす（ホーム画面のPWAは開きっぱなしのことが多い）
  setInterval(() => navigator.serviceWorker?.getRegistration().then((r) => r?.update()), 30 * 60 * 1000);
}

/** いまの画面が、入れかえても安全か（授業中は false） */
export function setUpdateSafe(isSafe: boolean) {
  safe = isSafe;
  if (safe && pending) void apply?.(true);
}
