import type { Episode } from "../domain/types";

/** 思い出（成長）ごとのシールの絵 */
export function StickerIcon({ kind, size = 72 }: { kind: Episode["kind"]; size?: number }) {
  const ink = "#1E2940";
  const common = { width: size, height: size, viewBox: "0 0 80 80", "aria-hidden": true } as const;
  switch (kind) {
    case "first_no_hint": // ほし
      return (
        <svg {...common}>
          <circle cx="40" cy="40" r="36" fill="#FFF6CC" stroke={ink} strokeWidth="3" />
          <path d="M40 14l7.6 15.4 17 2.5-12.3 12 2.9 16.9L40 52.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z" fill="#FFD23F" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
    case "faster": // ロケット
      return (
        <svg {...common}>
          <circle cx="40" cy="40" r="36" fill="#E7EEFC" stroke={ink} strokeWidth="3" />
          <path d="M40 14c10 8 13 20 10 32H30c-3-12 0-24 10-32z" fill="#fff" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="40" cy="32" r="5" fill="#3565D8" stroke={ink} strokeWidth="2.5" />
          <path d="M30 40l-8 10h9M50 40l8 10h-9" fill="#E0453A" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M35 50c0 8 5 12 5 12s5-4 5-12" fill="#FFB03A" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      );
    case "streak": // カレンダーに まる
      return (
        <svg {...common}>
          <circle cx="40" cy="40" r="36" fill="#FDEFDF" stroke={ink} strokeWidth="3" />
          <rect x="20" y="22" width="40" height="38" rx="6" fill="#fff" stroke={ink} strokeWidth="3" />
          <path d="M20 32h40" stroke={ink} strokeWidth="3" />
          <path d="M29 17v9M51 17v9" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M31 46c0-6 5-9 9-9 6 0 10 4 9 9-1 5-6 8-11 7-4-1-7-3-7-7" fill="none" stroke="#E0453A" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case "persisted": // 山の はた
      return (
        <svg {...common}>
          <circle cx="40" cy="40" r="36" fill="#DDF3E8" stroke={ink} strokeWidth="3" />
          <path d="M12 60l18-26 9 12 7-9 22 23z" fill="#16915F" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M46 37V16" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M46 17h14l-4 5 4 5H46z" fill="#E0453A" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      );
    case "mastered": // メダル
      return (
        <svg {...common}>
          <circle cx="40" cy="40" r="36" fill="#FFF6CC" stroke={ink} strokeWidth="3" />
          <path d="M28 12l8 20M52 12l-8 20" stroke="#3565D8" strokeWidth="7" strokeLinecap="round" />
          <circle cx="40" cy="46" r="17" fill="#FFD23F" stroke={ink} strokeWidth="3" />
          <path d="M31 46c0-6 4-9 9-9s9 3 9 9-4 9-9 9c-4 0-8-2-8-6" fill="none" stroke="#E0453A" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    default: // おうちの人から：ハート
      return (
        <svg {...common}>
          <circle cx="40" cy="40" r="36" fill="#FDE8EC" stroke={ink} strokeWidth="3" />
          <path d="M40 60S18 46 18 32c0-7 5-12 11-12 5 0 9 3 11 7 2-4 6-7 11-7 6 0 11 5 11 12 0 14-22 28-22 28z" fill="#FF7A93" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
  }
}

export const STICKER_NAME: Record<Episode["kind"], string> = {
  first_no_hint: "ヒントなし",
  faster: "スピードアップ",
  streak: "れんぞく",
  persisted: "さいごまで",
  mastered: "とくいわざ",
  parent: "おうちから",
};
