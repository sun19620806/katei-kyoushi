import { useRef, useState } from "react";
import { hourFromAngle, hourHandAngle, minuteFromAngle, minuteHandAngle, pickHand } from "../../domain/clockMath";

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

/** ○グラフ（たての列に ○を つむ。からの ○は かかない） */
export function CircleGraph({ title, labels, values, highlight }: { title: string; labels: string[]; values: number[]; highlight?: number[] }) {
  const max = Math.max(9, ...values);
  const col = 64;
  const cell = 26;
  const W = labels.length * col + 20;
  const H = max * cell + 70;
  return (
    <figure className="graph">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {Array.from({ length: max }, (_, k) => (
          <line key={k} x1="6" x2={W - 6} y1={H - 48 - k * cell - cell / 2} y2={H - 48 - k * cell - cell / 2} stroke="#E2E8F0" strokeWidth="1" />
        ))}
        {labels.map((label, i) => {
          const x = 10 + i * col + col / 2;
          const hot = highlight?.includes(i);
          return (
            <g key={label}>
              {hot && <rect x={x - col / 2 + 4} y={8} width={col - 8} height={max * cell + 8} rx="10" fill={MARKER} opacity=".45" />}
              {Array.from({ length: values[i] }, (_, k) => (
                <circle key={k} cx={x} cy={H - 48 - k * cell} r="10" fill={PENCIL} stroke={INK} strokeWidth="2" />
              ))}
              <text x={x} y={H - 14} textAnchor="middle" fontSize={label.length > 4 ? 11 : 14} fontWeight="800" fill={INK}>
                {label}
              </text>
            </g>
          );
        })}
        <line x1="6" x2={W - 6} y1={H - 32} y2={H - 32} stroke={INK} strokeWidth="2" />
      </svg>
    </figure>
  );
}

/** 数直線（数は 線の 上、やじるしは 下から 上を さす） */
export function NumberLineView({ start, unit, pos, showUnit }: { start: number; unit: number; pos: number; showUnit?: boolean }) {
  const ticks = 20;
  const W = 640;
  const x0 = 30;
  const step = (W - 60) / ticks;
  const ax = x0 + pos * step;
  return (
    <svg className="numberline" viewBox={`0 0 ${W} 160`} role="img" aria-label="かずの せん">
      <line x1={x0 - 10} x2={W - 20} y1="70" y2="70" stroke={INK} strokeWidth="3" />
      {Array.from({ length: ticks + 1 }, (_, k) => {
        const x = x0 + k * step;
        const major = k % 10 === 0;
        const mid = k % 5 === 0;
        return (
          <g key={k}>
            <line x1={x} x2={x} y1={major ? 52 : mid ? 58 : 62} y2={major ? 88 : mid ? 82 : 78} stroke={INK} strokeWidth={major ? 3 : 1.6} />
            {major && (
              <text x={x} y="38" textAnchor="middle" fontSize="20" fontWeight="800" fill={INK}>
                {start + k * unit}
              </text>
            )}
          </g>
        );
      })}
      <path d={`M${ax} 94 l-11 20 h22 z`} fill={ORANGE} />
      <rect x={ax - 4} y="112" width="8" height="22" rx="3" fill={ORANGE} />
      {showUnit && (
        <text x={W / 2} y="154" textAnchor="middle" fontSize="15" fontWeight="800" fill={ORANGE}>
          1めもり ＝ {unit}
        </text>
      )}
    </svg>
  );
}

/** はりを うごかせる とけい。value は 時×60＋分（時は 1〜12）。touched で さわったか を 知らせる */
export function ClockInput({ value, onChange, size = 300 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const h = Math.floor(value / 60) || 12;
  const m = value % 60;
  const dragging = useRef<"hour" | "minute" | null>(null);
  const [grab, setGrab] = useState<"hour" | "minute" | null>(null);
  const geometry = (e: { clientX: number; clientY: number }, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    return { angle: ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360, dist: Math.hypot(x, y) / (r.width / 2) };
  };
  const apply = (angle: number, hand: "hour" | "minute") => {
    if (hand === "minute") onChange(h * 60 + minuteFromAngle(angle));
    else onChange(hourFromAngle(angle, m) * 60 + m);
  };
  const hand = (angle: number, length: number, width: number, color: string, name: "hour" | "minute") => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x2 = 100 + Math.cos(rad) * length;
    const y2 = 100 + Math.sin(rad) * length;
    const hot = grab === name;
    return (
      <g className={`hand ${name}`}>
        <line x1="100" y1="100" x2={x2} y2={y2} stroke={hot ? ORANGE : color} strokeWidth={hot ? width + 2 : width} strokeLinecap="round" />
        <circle cx={x2} cy={y2} r={name === "minute" ? 13 : 15} fill={hot ? ORANGE : color} opacity={hot ? 0.45 : 0.2} />
      </g>
    );
  };
  const end = () => {
    dragging.current = null;
    setGrab(null);
  };
  return (
    <svg
      className="clock clock-input"
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="slider"
      tabIndex={0}
      aria-label="とけいの はり"
      aria-valuemin={60}
      aria-valuemax={775}
      aria-valuenow={h * 60 + m}
      aria-valuetext={`${h}時${m}分`}
      style={{ touchAction: "none" }}
      onKeyDown={(e) => {
        // キーボード：←→ で 5分、↑↓ で 1時間
        const delta = { ArrowRight: 5, ArrowLeft: -5, ArrowUp: 60, ArrowDown: -60 }[e.key];
        if (!delta) return;
        e.preventDefault();
        const next = (((h % 12) * 60 + m + delta) % 720 + 720) % 720;
        onChange((Math.floor(next / 60) || 12) * 60 + (next % 60));
      }}
      onPointerDown={(e) => {
        const svg = e.currentTarget;
        const g = geometry(e, svg);
        const which = pickHand(g.angle, g.dist, h, m);
        dragging.current = which;
        setGrab(which);
        try {
          svg.setPointerCapture(e.pointerId);
        } catch {
          /* つかめなくても うごかせる */
        }
        apply(g.angle, which);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        apply(geometry(e, e.currentTarget).angle, dragging.current);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <circle cx="100" cy="100" r="94" fill="#fff" stroke={INK} strokeWidth="5" />
      {Array.from({ length: 60 }, (_, i) => {
        const rad = ((i * 6 - 90) * Math.PI) / 180;
        const long = i % 5 === 0;
        return <line key={i} x1={100 + Math.cos(rad) * (long ? 80 : 85)} y1={100 + Math.sin(rad) * (long ? 80 : 85)} x2={100 + Math.cos(rad) * 90} y2={100 + Math.sin(rad) * 90} stroke={INK} strokeWidth={long ? 3 : 1.2} />;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const rad = ((n * 30 - 90) * Math.PI) / 180;
        return (
          <text key={n} x={100 + Math.cos(rad) * 66} y={100 + Math.sin(rad) * 66 + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill={INK} pointerEvents="none">
            {n}
          </text>
        );
      })}
      {hand(minuteHandAngle(m), 78, 6, PENCIL, "minute")}
      {hand(hourHandAngle(h, m), 48, 10, INK, "hour")}
      <circle cx="100" cy="100" r="6" fill={INK} />
    </svg>
  );
}
