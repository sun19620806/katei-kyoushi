/** 問題の図（とけい・形・分数・位の積み木・単位のテープ） */

const INK = "#1E2940";
const PENCIL = "#3565D8";
const ORANGE = "#C9650F";
const MARKER = "#FFE066";

/** アナログとけい。hot で短いはり／長いはりを色づけ */
export function ClockFace({ h, m, hot, size = 280 }: { h: number; m: number; hot?: "hour" | "minute" | null; size?: number }) {
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minuteAngle = m * 6;
  const hand = (angle: number, length: number, width: number, color: string) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return <line x1="100" y1="100" x2={100 + Math.cos(rad) * length} y2={100 + Math.sin(rad) * length} stroke={color} strokeWidth={width} strokeLinecap="round" />;
  };
  return (
    <svg className="clock" width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="とけい">
      <circle cx="100" cy="100" r="94" fill="#fff" stroke={INK} strokeWidth="5" />
      {Array.from({ length: 60 }, (_, i) => {
        const rad = ((i * 6 - 90) * Math.PI) / 180;
        const long = i % 5 === 0;
        const r1 = long ? 80 : 85;
        return (
          <line
            key={i}
            x1={100 + Math.cos(rad) * r1}
            y1={100 + Math.sin(rad) * r1}
            x2={100 + Math.cos(rad) * 90}
            y2={100 + Math.sin(rad) * 90}
            stroke={INK}
            strokeWidth={long ? 3 : 1.2}
          />
        );
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const rad = ((n * 30 - 90) * Math.PI) / 180;
        return (
          <text key={n} x={100 + Math.cos(rad) * 66} y={100 + Math.sin(rad) * 66 + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill={INK}>
            {n}
          </text>
        );
      })}
      {hand(minuteAngle, 78, hot === "minute" ? 7 : 5, hot === "minute" ? ORANGE : PENCIL)}
      {hand(hourAngle, 48, hot === "hour" ? 11 : 9, hot === "hour" ? ORANGE : INK)}
      <circle cx="100" cy="100" r="6" fill={INK} />
    </svg>
  );
}

type P = [number, number];
const poly = (pts: P[], closed = true) => `M${pts.map((p) => p.join(",")).join(" L")}${closed ? " Z" : ""}`;

/** 形の図。code は "tri" "quad_open" など */
export function ShapeGlyph({ code, rotate = 0, size = 120 }: { code: string; rotate?: number; size?: number }) {
  const shapes: Record<string, string> = {
    tri: poly([[50, 12], [90, 84], [12, 80]]),
    tri_open: "M50 12 L90 84 L12 80 L30 47",
    tri_curve: "M50 12 L90 84 Q50 60 12 80 Z",
    right_tri: poly([[18, 16], [18, 84], [86, 84]]),
    right_tri_open: "M18 16 L18 84 L86 84 L56 54",
    quad: poly([[20, 20], [84, 14], [90, 80], [10, 86]]),
    quad_open: "M20 20 L84 14 L90 80 L10 86 L15 56",
    quad_curve: "M20 20 Q52 2 84 14 L90 80 L10 86 Z",
    pent: poly([[50, 10], [90, 40], [74, 88], [26, 88], [10, 40]]),
    rect: poly([[8, 26], [92, 26], [92, 74], [8, 74]]),
    rect_open: "M8 26 L92 26 L92 74 L8 74 L8 56",
    square: poly([[18, 18], [82, 18], [82, 82], [18, 82]]),
    square_open: "M18 18 L82 18 L82 82 L18 82 L18 56",
    rhombus: poly([[50, 8], [90, 50], [50, 92], [10, 50]]),
    parallelogram: poly([[26, 24], [94, 24], [74, 76], [6, 76]]),
  };
  const d = shapes[code] ?? shapes.tri;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g transform={`rotate(${rotate} 50 50)`}>
        <path d={d} fill="#E7EEFC" stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 分数の図。"frac:4:1:equal:circle" */
export function FractionGlyph({ parts, shaded, equal, shape, size = 120 }: { parts: number; shaded: number; equal: boolean; shape: string; size?: number }) {
  // 等しくない分け方：わざと大きさをばらばらにする
  const weights = Array.from({ length: parts }, (_, i) => (equal ? 1 : [1.9, 0.6, 1.2, 0.5, 1.4, 0.7, 1, 0.8][i % 8]));
  const sum = weights.reduce((a, b) => a + b, 0);
  const cut = weights.map((_, i) => weights.slice(0, i).reduce((a, b) => a + b, 0) / sum);

  if (shape === "circle") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        {cut.map((start, i) => {
          const end = i + 1 < parts ? cut[i + 1] : 1;
          const a0 = start * 2 * Math.PI - Math.PI / 2;
          const a1 = end * 2 * Math.PI - Math.PI / 2;
          const large = end - start > 0.5 ? 1 : 0;
          const d = `M50 50 L${50 + 42 * Math.cos(a0)} ${50 + 42 * Math.sin(a0)} A42 42 0 ${large} 1 ${50 + 42 * Math.cos(a1)} ${50 + 42 * Math.sin(a1)} Z`;
          return <path key={i} d={d} fill={i < shaded ? MARKER : "#fff"} stroke={INK} strokeWidth="3" strokeLinejoin="round" />;
        })}
      </svg>
    );
  }
  const w = shape === "tape" ? 92 : 80;
  const hgt = shape === "tape" ? 34 : 64;
  const x0 = (100 - w) / 2;
  const y0 = (100 - hgt) / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {cut.map((start, i) => {
        const end = i + 1 < parts ? cut[i + 1] : 1;
        return <rect key={i} x={x0 + start * w} y={y0} width={(end - start) * w} height={hgt} fill={i < shaded ? MARKER : "#fff"} stroke={INK} strokeWidth="3" />;
      })}
    </svg>
  );
}

/** 選択肢のコードを図にする。図でなければ null */
export function ChoiceVisual({ code }: { code: string }) {
  if (code.startsWith("shape:")) {
    const [, kind, rot] = code.split(":");
    return <ShapeGlyph code={kind} rotate={Number(rot) || 0} />;
  }
  if (code.startsWith("frac:")) {
    const [, parts, shaded, eq, shape] = code.split(":");
    return <FractionGlyph parts={Number(parts)} shaded={Number(shaded)} equal={eq === "equal"} shape={shape} />;
  }
  return null;
}

/** 位の積み木：千=大きな板、百=板、十=棒、一=ばら */
export function PlaceBlocks({ thousands, hundreds, tens, ones, table }: { thousands: number; hundreds: number; tens: number; ones: number; table: boolean }) {
  const cols: [string, number, string][] = [
    ["千", thousands, "b1000"],
    ["百", hundreds, "b100"],
    ["十", tens, "b10"],
    ["一", ones, "b1"],
  ];
  return (
    <div className={`place ${table ? "table" : ""}`}>
      {cols.map(([label, n, cls]) => (
        <div key={label} className="place-col">
          <div className="place-head">{label}のくらい</div>
          <div className={`place-blocks ${cls}`}>
            {Array.from({ length: n }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="place-count">
            {n}こ
          </div>
        </div>
      ))}
    </div>
  );
}

/** 単位のテープ：1big = ratio small が a こ分と、のこり */
export function UnitTape({ a, big, small, ratio }: { a: number; big: string; small: string; ratio: number }) {
  return (
    <div className="tape" aria-label={`1${big}は ${ratio}${small}`}>
      {Array.from({ length: a }, (_, i) => (
        <div key={i} className="tape-seg">
          <span className="ticks" />
          <b>
            1{big} ＝ {ratio}{small}
          </b>
        </div>
      ))}
      <div className="tape-seg rest">
        <b>のこり</b>
      </div>
    </div>
  );
}

/** わけるときの図：a この おはじきと、b まいの からの おさら（答えは見せない） */
export function FracGroups({ a, b }: { a: number; b: number }) {
  return (
    <div className="frac-groups" aria-label={`${a}こを ${b}つに わける`}>
      <div className="dot-group">
        {Array.from({ length: a }, (_, j) => (
          <span key={j} className="dot" />
        ))}
      </div>
      <div className="plates">
        {Array.from({ length: b }, (_, i) => (
          <div key={i} className={`plate ${i === 0 ? "one" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export const COLORS = { INK, PENCIL, ORANGE, MARKER };
