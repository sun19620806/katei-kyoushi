import { useEffect, useRef, useState } from "react";
import { recognizeDigit } from "../../domain/handwriting/digits";
import type { Template } from "../../domain/handwriting/pdollar";

type XY = { x: number; y: number };

export interface Written {
  value: string; // よみとった すうじ（空のマスは とばす）
  boxes: { digit: number | null; strokes: XY[][] }[];
}

interface Props {
  boxes: number; // マスの数
  templates: Template[]; // その子の字（これまでに たしかめた もの）
  onChange: (w: Written) => void;
  onSubmit: () => void;
  resetKey: string; // 問題が かわったら マスを 空に する
}

const RECOGNIZE_DELAY = 700; // ペンを はなしてから 読むまで（4・5・7 など 2画の 字を 待つ）

/** Apple Pencil・ゆびで すうじを 書く。1マスに 1もじ */
export default function HandwritePad({ boxes, templates, onChange, onSubmit, resetKey }: Props) {
  const [cells, setCells] = useState<{ digit: number | null; strokes: XY[][]; alternatives: number[]; unsure: boolean }[]>(() =>
    Array.from({ length: boxes }, () => ({ digit: null, strokes: [], alternatives: [], unsure: false })),
  );

  useEffect(() => {
    setCells(Array.from({ length: boxes }, () => ({ digit: null, strokes: [], alternatives: [], unsure: false })));
  }, [resetKey, boxes]);

  useEffect(() => {
    onChange({
      value: cells.map((c) => (c.digit === null ? "" : String(c.digit))).join(""),
      boxes: cells.map(({ digit, strokes }) => ({ digit, strokes })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells]);

  const update = (i: number, patch: Partial<(typeof cells)[number]>) =>
    setCells((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const [generation, setGeneration] = useState(0);
  const filled = cells.some((c) => c.digit !== null);

  return (
    <div className="handwrite">
      <div className="hw-boxes" style={{ gridTemplateColumns: `repeat(${boxes}, 1fr)` }}>
        {cells.map((c, i) => (
          <InkBox
            key={`${resetKey}-${generation}-${i}`}
            digit={c.digit}
            unsure={c.unsure}
            alternatives={c.alternatives}
            onStrokes={(strokes) => {
              const r = recognizeDigit(strokes, templates);
              const unsure = r.digit !== null && (r.score < 0.35 || isConfusable(r.digit, r.alternatives[0]));
              update(i, { strokes, digit: r.digit, alternatives: r.alternatives, unsure });
            }}
            onPick={(d) => update(i, { digit: d, unsure: false, alternatives: [] })}
            onClear={() => update(i, { digit: null, strokes: [], alternatives: [], unsure: false })}
          />
        ))}
      </div>
      <div className="hw-actions">
        <button
          className="erase"
          disabled={!filled}
          onClick={() => {
            setCells(cells.map(() => ({ digit: null, strokes: [], alternatives: [], unsure: false })));
            setGeneration((g) => g + 1);
          }}
        >
          ぜんぶ けす
        </button>
        <button className="submit" disabled={!filled} onClick={onSubmit}>
          こたえる
        </button>
      </div>
    </div>
  );
}

/** まちがえやすい組み合わせ（3と5、7と9、1と7）は、たしかめて もらう */
function isConfusable(a: number, b: number | undefined) {
  if (b === undefined) return false;
  const pair = [a, b].sort().join("");
  return ["35", "79", "17"].includes(pair);
}

interface InkBoxProps {
  digit: number | null;
  unsure: boolean;
  alternatives: number[];
  onStrokes: (s: XY[][]) => void;
  onPick: (d: number) => void;
  onClear: () => void;
}

function InkBox({ digit, unsure, alternatives, onStrokes, onPick, onClear }: InkBoxProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<XY[][]>([]);
  const drawing = useRef(false);
  const penSeen = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  // 高解像度の画面に合わせる
  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redraw = () => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#3565D8";
    for (const s of strokes.current) {
      ctx.beginPath();
      s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y);
      ctx.stroke();
    }
  };

  const point = (e: PointerEvent | React.PointerEvent): XY => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") penSeen.current = true;
    if (penSeen.current && e.pointerType === "touch") return; // ペンを つかって いるときは 手のひらを むし
    e.preventDefault();
    window.clearTimeout(timer.current);
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([point(e)]);
    redraw();
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const native = e.nativeEvent;
    const coalesced = native.getCoalescedEvents?.() ?? [];
    const events = coalesced.length > 0 ? coalesced : [native];
    const s = strokes.current[strokes.current.length - 1];
    for (const ev of events) s.push(point(ev));
    redraw();
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    timer.current = window.setTimeout(() => onStrokes(strokes.current.map((s) => [...s])), RECOGNIZE_DELAY);
  };

  const clear = () => {
    strokes.current = [];
    redraw();
    onClear();
  };

  return (
    <div className={`ink-box ${digit !== null ? "has" : ""} ${unsure ? "unsure" : ""}`}>
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="ここに すうじを かく" />
      {digit !== null && <span className="ink-read" aria-live="polite">{digit}</span>}
      {strokes.current.length > 0 && (
        <button className="ink-clear" onClick={clear} aria-label="この マスを けす">
          ×
        </button>
      )}
      {unsure && digit !== null && (
        <div className="ink-alt">
          {[digit, ...alternatives.slice(0, 2)].map((d) => (
            <button key={d} onClick={() => onPick(d)}>
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
