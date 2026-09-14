/** 先生の見た目：ノートから生まれた生き物。人間には見せない */
export type Face = "smile" | "think" | "wow" | "calm";

export default function Teacher({ face = "smile", size = 120 }: { face?: Face; size?: number }) {
  return (
    <svg className="teacher" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="せんせい">
      <rect x="18" y="14" width="86" height="96" rx="14" fill="#fff" stroke="#1E2940" strokeWidth="4" />
      {[30, 48, 66, 84].map((y) => (
        <circle key={y} cx="18" cy={y} r="5" fill="#F5F7FA" stroke="#1E2940" strokeWidth="3" />
      ))}
      {[40, 54, 68, 82, 96].map((y) => (
        <line key={y} x1="30" y1={y} x2="94" y2={y} stroke="#E2E8F0" strokeWidth="2" />
      ))}
      <rect x="56" y="4" width="10" height="22" rx="3" fill="#3565D8" transform="rotate(18 61 15)" />
      {face === "think" ? (
        <>
          <path d="M42 56 q6 -5 12 0" stroke="#1E2940" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="78" cy="56" r="5" fill="#1E2940" />
          <path d="M52 80 h20" stroke="#1E2940" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="48" cy="56" r={face === "wow" ? 6 : 5} fill="#1E2940" />
          <circle cx="78" cy="56" r={face === "wow" ? 6 : 5} fill="#1E2940" />
          {face === "wow" ? (
            <ellipse cx="63" cy="80" rx="7" ry="8" fill="#1E2940" />
          ) : face === "calm" ? (
            <path d="M52 78 q11 6 22 0" stroke="#1E2940" strokeWidth="4" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M48 74 q15 16 30 0" stroke="#1E2940" strokeWidth="4" fill="#FFB4A8" strokeLinecap="round" />
          )}
          <circle cx="38" cy="70" r="5" fill="#FFB4A8" opacity=".7" />
          <circle cx="88" cy="70" r="5" fill="#FFB4A8" opacity=".7" />
        </>
      )}
    </svg>
  );
}
