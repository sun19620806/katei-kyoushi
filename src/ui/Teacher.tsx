/** 先生の見た目。人間には見せない（ノート・えんぴつ・けしごむ から子どもが選ぶ） */
export type Face = "smile" | "think" | "wow" | "calm";
export type TeacherLook = "note" | "pencil" | "eraser";

const INK = "#1E2940";

function FaceParts({ face, cx = 63, cy = 56 }: { face: Face; cx?: number; cy?: number }) {
  const l = cx - 15;
  const r = cx + 15;
  if (face === "think") {
    return (
      <>
        <path d={`M${l - 6} ${cy} q6 -5 12 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx={r} cy={cy} r="5" fill={INK} />
        <path d={`M${cx - 11} ${cy + 24} h20`} stroke={INK} strokeWidth="4" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <circle cx={l} cy={cy} r={face === "wow" ? 6 : 5} fill={INK} />
      <circle cx={r} cy={cy} r={face === "wow" ? 6 : 5} fill={INK} />
      {face === "wow" ? (
        <ellipse cx={cx} cy={cy + 24} rx="7" ry="8" fill={INK} />
      ) : face === "calm" ? (
        <path d={`M${cx - 11} ${cy + 22} q11 6 22 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M${cx - 15} ${cy + 18} q15 16 30 0`} stroke={INK} strokeWidth="4" fill="#FFB4A8" strokeLinecap="round" />
      )}
      <circle cx={l - 10} cy={cy + 14} r="5" fill="#FFB4A8" opacity=".7" />
      <circle cx={r + 10} cy={cy + 14} r="5" fill="#FFB4A8" opacity=".7" />
    </>
  );
}

export default function Teacher({ face = "smile", size = 120, look = "note" }: { face?: Face; size?: number; look?: TeacherLook }) {
  return (
    <svg className={`teacher look-${look}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="せんせい">
      {look === "pencil" ? (
        <>
          <path d="M34 26h52v70l-26 20-26-20z" fill="#FFD23F" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M34 96l26 20 26-20z" fill="#F5DDB5" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M52 110l8 6 8-6z" fill={INK} />
          <rect x="34" y="8" width="52" height="18" rx="6" fill="#FF9DB0" stroke={INK} strokeWidth="4" />
          <path d="M34 22h52" stroke="#8A94A8" strokeWidth="6" />
          <FaceParts face={face} cx={60} cy={52} />
        </>
      ) : look === "eraser" ? (
        <>
          <rect x="16" y="20" width="88" height="84" rx="16" fill="#fff" stroke={INK} strokeWidth="4" />
          <path d="M16 62h88v26a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16z" fill="#3565D8" stroke={INK} strokeWidth="4" />
          <path d="M24 72h72" stroke="#fff" strokeWidth="3" opacity=".6" />
          <FaceParts face={face} cx={60} cy={40} />
        </>
      ) : (
        <>
          <rect x="18" y="14" width="86" height="96" rx="14" fill="#fff" stroke={INK} strokeWidth="4" />
          {[30, 48, 66, 84].map((y) => (
            <circle key={y} cx="18" cy={y} r="5" fill="#F5F7FA" stroke={INK} strokeWidth="3" />
          ))}
          {[40, 54, 68, 82, 96].map((y) => (
            <line key={y} x1="30" y1={y} x2="94" y2={y} stroke="#E2E8F0" strokeWidth="2" />
          ))}
          <rect x="56" y="4" width="10" height="22" rx="3" fill="#3565D8" transform="rotate(18 61 15)" />
          <FaceParts face={face} />
        </>
      )}
    </svg>
  );
}
