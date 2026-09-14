import type { HintVisual, Problem } from "../../domain/types";

export const opSymbol = (p: Problem) => (p.kind === "add" ? "+" : p.kind === "sub" ? "−" : "×");

export const problemSpeech = (p: Problem) => `${p.a} ${opSymbol(p)} ${p.b} は？`;

interface Props {
  problem: Problem;
  input: string;
  visual: HintVisual | null;
  revealed: boolean;
  state: "answering" | "correct" | "revealed" | "other";
}

export default function ProblemView({ problem, input, visual, revealed, state }: Props) {
  const shown = revealed ? String(problem.answer) : input;
  return (
    <div className={`problem state-${state}`}>
      {problem.layout === "vertical" ? (
        <Hissan problem={problem} shown={shown} visual={visual} revealed={revealed} />
      ) : (
        <div className="inline-eq">
          <span>{problem.a}</span>
          <span className="op">{opSymbol(problem)}</span>
          <span>{problem.b}</span>
          <span className="op">=</span>
          <span className={`answer-box ${revealed ? "revealed" : ""}`}>{shown || " "}</span>
        </div>
      )}
      {visual === "array" && problem.kind === "mul" && <DotArray n={problem.a} m={problem.b} />}
    </div>
  );
}

/** 筆算。一の位・十の位をヒントに合わせて光らせる */
function Hissan({ problem, shown, visual, revealed }: { problem: Problem; shown: string; visual: HintVisual | null; revealed: boolean }) {
  const d = (n: number) => [Math.floor(n / 10), n % 10];
  const [a10, a1] = d(problem.a);
  const [b10, b1] = d(problem.b);
  const ans = shown.padStart(2, " ").slice(-3);
  const hot = (col: "tens" | "ones") =>
    (visual === "ones_highlight" && col === "ones") || (visual === "tens_highlight" && col === "tens") ? "hot" : "";
  const borrow = visual === "borrow_mark" && problem.kind === "sub";
  const carry = visual === "carry_mark" && problem.kind === "add";

  return (
    <div className="hissan" aria-label={`${problem.a} ${opSymbol(problem)} ${problem.b}`}>
      <div className="h-row small">
        <span />
        <span className="cell">{carry ? <em className="mark">1</em> : borrow ? <em className="mark">{a10 - 1}</em> : ""}</span>
        <span className="cell">{borrow ? <em className="mark">10</em> : ""}</span>
      </div>
      <div className="h-row">
        <span />
        <span className={`cell ${hot("tens")}`}>{borrow ? <s>{a10}</s> : a10}</span>
        <span className={`cell ${hot("ones")}`}>{a1}</span>
      </div>
      <div className="h-row">
        <span className="op">{opSymbol(problem)}</span>
        <span className={`cell ${hot("tens")}`}>{b10}</span>
        <span className={`cell ${hot("ones")}`}>{b1}</span>
      </div>
      <div className="h-rule" />
      <div className={`h-row answer ${revealed ? "revealed" : ""}`}>
        <span className="cell">{ans.length > 2 ? ans[0] : ""}</span>
        <span className={`cell ${hot("tens")}`}>{ans.at(-2)?.trim()}</span>
        <span className={`cell ${hot("ones")}`}>{ans.at(-1)?.trim()}</span>
      </div>
    </div>
  );
}

/** かけ算の図：n が m こ */
function DotArray({ n, m }: { n: number; m: number }) {
  return (
    <div className="dots" aria-label={`${n}が ${m}こ`}>
      {Array.from({ length: m }, (_, r) => (
        <div key={r} className="dot-row">
          {Array.from({ length: n }, (_, c) => (
            <span key={c} className="dot" />
          ))}
          <b>{r + 1}</b>
        </div>
      ))}
    </div>
  );
}
