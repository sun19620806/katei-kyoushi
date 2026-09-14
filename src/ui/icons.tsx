/** 画面で使う小さな絵（絵文字は使わない） */
type P = { size?: number };

export const SpeakerIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
    <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const CloseIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const ArrowIcon = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const StarIcon = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="currentColor" />
  </svg>
);

export const BulbIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="currentColor" />
    <rect x="9" y="17.5" width="6" height="2" rx="1" fill="currentColor" />
    <rect x="10" y="20.5" width="4" height="1.6" rx=".8" fill="currentColor" />
  </svg>
);

/** 気分チェックの顔 */
export function MoodFace({ mood, size = 64 }: { mood: "genki" | "futsu" | "tsukare"; size?: number }) {
  const fill = mood === "genki" ? "#FFE066" : mood === "futsu" ? "#CFE0FB" : "#E3E1EC";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill={fill} stroke="#1E2940" strokeWidth="3" />
      {mood === "tsukare" ? (
        <>
          <path d="M19 27h8M37 27h8" stroke="#1E2940" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 44q8-4 16 0" stroke="#1E2940" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="23" cy="27" r="3.5" fill="#1E2940" />
          <circle cx="41" cy="27" r="3.5" fill="#1E2940" />
          {mood === "genki" ? (
            <path d="M20 38q12 14 24 0z" fill="#1E2940" />
          ) : (
            <path d="M23 41h18" stroke="#1E2940" strokeWidth="3" strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
  );
}

/** 赤ペンの「まる」 */
export const RedCircle = () => (
  <svg className="red-circle" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
    <path d="M30 70 C 20 25, 120 5, 170 35 C 205 60, 170 110, 95 112 C 40 114, 12 90, 28 62" />
  </svg>
);
