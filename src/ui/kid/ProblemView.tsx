import type { ReactNode } from "react";
import { digit } from "../../domain/math/diagnose";
import type { HintVisual, Problem } from "../../domain/types";
import { RedCircle, SpeakerIcon } from "../icons";
import { speak } from "../speech";
import { ClockFace, FracGroups, PlaceBlocks, UnitTape } from "./visuals";

export const opSymbol = (p: Problem) => (p.kind === "add" ? "+" : p.kind === "sub" ? "−" : "×");

/** 問題の読み上げ文 */
export function problemSpeech(p: Problem, step: number): string {
  switch (p.layout) {
    case "vertical":
      return `ひっさんで けいさんしよう。${p.a} ${opSymbol(p)} ${p.b}`;
    case "missing":
      return `${p.a} かける なにが ${p.product}？`;
    case "story":
      return step === 0 ? `${p.story} しきを えらぼう。` : "こたえは？";
    case "length":
      return p.kind === "len_to_cm" ? `${p.a}m ${p.b}cmは なんcm？` : `${p.cm}cmは ${p.a}m なんcm？`;
    case "unit": {
      const u = p.unit!;
      return p.kind === "unit_to_small" ? `${p.a}${u.big} ${p.b}${u.small}は なん${u.small}？` : `${u.total}${u.small}は ${p.a}${u.big} なん${u.small}？`;
    }
    case "clock":
      if (step > 0) return p.steps[step].prompt;
      return p.clock?.shift
        ? `この とけいの ${p.clock.shift}分${p.clock.dir === "before" ? "前" : "後"}の 時こくは？ なん時？`
        : "この とけいは なん時？";
    case "fraction":
      return `${p.a}この 1/${p.b}は なんこ？`;
    case "place": {
      const pl = p.place!;
      return `1000を ${pl.thousands}こ、100を ${pl.hundreds}こ、10を ${pl.tens}こ、1を ${pl.ones}こ あわせた かずは？`;
    }
    case "shape":
      return p.steps[0].prompt;
    case "rule":
      return p.rule === "step" ? `${p.a}×${p.b + 1}は、${p.a}×${p.b}より いくつ 大きい？` : `□ × ${p.a} = ${p.a} × ${p.b}。□に はいる かずは？`;
    case "compare":
      return `${p.a} と ${p.b}、どちらが 大きい？`;
    case "kanji_read":
      // 読みの問題は、文を読み上げると答えがわかってしまうので読まない
      return "せんの 漢字の 読みかたは どれかな？";
    case "kanji_write":
      return `${p.jp!.sentence!.replace("{blank}", p.jp!.reading!)} ${p.jp!.reading}に 合う 漢字は どれ？`;
    case "katakana":
      return `${p.jp!.clue}。${p.jp!.reading}を かたかなで 書くと どれ？`;
    case "grammar":
      return `${p.jp!.sentence} ${p.steps[0].prompt}`;
    case "reading":
      return `もんだい${step + 1}。${p.steps[step].prompt}`;
    case "particle":
      return "□に 入る 字は どれかな？";
    case "vocab":
      return p.jp!.vocabType === "opposite" ? `${p.jp!.word}の はんたいの いみの ことばは どれ？` : `${p.jp!.word}の なかまに 入る ことばは どれ？`;
    default:
      return `${p.a} ${opSymbol(p)} ${p.b} は？`;
  }
}

export type ViewState = "answering" | "correct" | "revealed";

interface Props {
  problem: Problem;
  step: number;
  input: string;
  visual: HintVisual | null;
  state: ViewState;
  noHint: boolean; // ヒントなし・1回目で正解
}

export default function ProblemView({ problem: p, step, input, visual, state, noHint }: Props) {
  const lastStep = p.steps.length - 1;
  const onLast = step === lastStep || state !== "answering";
  const value = state === "answering" ? (onLast ? input : "") : String(p.answer);
  const box = (content: string, extra = "") => (
    <Answer value={content} state={state} extra={extra} />
  );

  let body: ReactNode;
  switch (p.layout) {
    case "vertical":
      body = <Hissan problem={p} shown={value} visual={visual} state={state} />;
      break;
    case "missing":
      body = (
        <div className="eq">
          <span>{p.a}</span>
          <span className="op">×</span>
          {box(value)}
          <span className="op">=</span>
          <span>{p.product}</span>
        </div>
      );
      break;
    case "length":
      body =
        p.kind === "len_to_cm" ? (
          <div className="eq length">
            <span>{p.a}</span><small>m</small>
            <span>{p.b}</span><small>cm</small>
            <span className="op">=</span>
            {box(value)}<small>cm</small>
          </div>
        ) : (
          <div className="eq length">
            <span>{p.cm}</span><small>cm</small>
            <span className="op">=</span>
            <span>{p.a}</span><small>m</small>
            {box(value)}<small>cm</small>
          </div>
        );
      break;
    case "unit": {
      const u = p.unit!;
      body =
        p.kind === "unit_to_small" ? (
          <div className="eq length">
            <span>{p.a}</span><small>{u.big}</small>
            <span>{p.b}</span><small>{u.small}</small>
            <span className="op">=</span>
            {box(value)}<small>{u.small}</small>
          </div>
        ) : (
          <div className="eq length">
            <span>{u.total}</span><small>{u.small}</small>
            <span className="op">=</span>
            <span>{p.a}</span><small>{u.big}</small>
            {box(value)}<small>{u.small}</small>
          </div>
        );
      break;
    }
    case "clock": {
      const c = p.clock!;
      const hot = visual === "hour_hand" ? "hour" : visual === "minute_hand" ? "minute" : null;
      const hourText = step > 0 || state !== "answering" ? String(p.steps[0].answer) : onLast ? "" : input;
      const minuteText = state !== "answering" ? String(p.steps[1].answer) : step === 1 ? input : "";
      body = (
        <div className="clock-wrap">
          <ClockFace h={c.h} m={c.m} hot={hot} />
          <div className="clock-side">
            {c.shift && (
              <p className="clock-q">
                この とけいの <b>{c.shift}分{c.dir === "before" ? "前" : "後"}</b>の 時こくは？
              </p>
            )}
            <div className="eq time">
              <Answer value={hourText} state={step === 0 || state !== "answering" ? state : "correct-step"} extra={step === 0 && state === "answering" ? "now" : ""} />
              <small>時</small>
              <Answer value={minuteText} state={state} extra={step === 1 && state === "answering" ? "now" : ""} />
              <small>分</small>
            </div>
          </div>
        </div>
      );
      break;
    }
    case "fraction":
      body = (
        <div className="eq fraction">
          <span>{p.a}</span><small>この</small>
          <Frac n={1} d={p.b} />
          <small>は</small>
          {box(value)}<small>こ</small>
        </div>
      );
      break;
    case "place": {
      const pl = p.place!;
      body = (
        <div className="place-wrap">
          <PlaceBlocks {...pl} table={visual === "place_table"} />
          <div className="eq">{box(value, "wide")}</div>
        </div>
      );
      break;
    }
    case "shape":
      body = <p className="shape-q">{p.steps[0].prompt}</p>;
      break;
    case "rule":
      body =
        p.rule === "step" ? (
          <div className="rule">
            <div className="eq small-eq">
              <span>{p.a}</span><span className="op">×</span><span>{p.b + 1}</span><span className="op">は</span>
            </div>
            <div className="eq small-eq">
              <span>{p.a}</span><span className="op">×</span><span>{p.b}</span><span className="op">より</span>
              {box(value)}<small>大きい</small>
            </div>
          </div>
        ) : (
          <div className="eq">
            {box(value)}
            <span className="op">×</span><span>{p.a}</span><span className="op">=</span><span>{p.a}</span><span className="op">×</span><span>{p.b}</span>
          </div>
        );
      break;
    case "compare": {
      const st = p.steps[0];
      const sign = state === "answering" ? "" : st.choices![st.answer];
      body = (
        <div className="eq compare">
          <span>{p.a}</span>
          <span className={`answer sign ${state}`}>
            <span className="answer-text">{sign || " "}</span>
            {state === "correct" && <RedCircle />}
          </span>
          <span>{p.b}</span>
        </div>
      );
      break;
    }
    case "kanji_read":
    case "kanji_write":
    case "katakana":
    case "grammar":
    case "reading":
    case "vocab":
    case "particle":
      body = <JapaneseView problem={p} step={step} state={state} />;
      break;
    case "story": {
      const expr = p.steps[0].choices![p.steps[0].answer];
      const exprKnown = step > 0 || state !== "answering";
      body = (
        <div className="story">
          <p className="story-text">{highlightNumbers(p.story ?? "")}</p>
          <div className="story-eq">
            <span className="label">しき</span>
            {exprKnown ? <span className="expr">{expr} =</span> : <span className="expr blank">？</span>}
            {exprKnown && box(value)}
            {exprKnown && <small>{p.steps[1].unit}</small>}
          </div>
        </div>
      );
      break;
    }
    default:
      body = (
        <div className="eq">
          <span>{p.a}</span>
          <span className="op">{opSymbol(p)}</span>
          <span>{p.b}</span>
          <span className="op">=</span>
          {box(value)}
        </div>
      );
  }

  const showArray = visual === "array" && (p.kind === "mul" || p.kind === "mul_missing" || p.kind === "mul_word");
  const showUnitTape = (visual === "unit_tape" || visual === "meter_tape") && p.unit;
  return (
    <div className={`page state-${state}`}>
      {state === "correct" && noHint && <span className="badge-nohint">ヒントなし</span>}
      {state === "revealed" && <span className="badge-reveal">こたえ</span>}
      <div className="page-body">{body}</div>
      {showArray && <DotArray n={p.a} m={p.b} />}
      {visual === "meter_tape" && !p.unit && <MeterTape m={p.a} />}
      {showUnitTape && <UnitTape a={p.a} big={p.unit!.big} small={p.unit!.small} ratio={p.unit!.ratio} />}
      {visual === "frac_groups" && p.kind === "fraction_of" && <FracGroups a={p.a} b={p.b} />}
    </div>
  );
}

function Answer({ value, state, extra }: { value: string; state: ViewState | "correct-step"; extra: string }) {
  return (
    <span className={`answer ${extra} ${state}`}>
      <span className="answer-text">{value || " "}</span>
      {state === "correct" && <RedCircle />}
    </span>
  );
}

/** たての分数 */
function Frac({ n, d }: { n: number; d: number }) {
  return (
    <span className="frac" aria-label={`${d}ぶんの${n}`}>
      <span>{n}</span>
      <span className="frac-bar" />
      <span>{d}</span>
    </span>
  );
}

function highlightNumbers(text: string) {
  return text.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <b key={i}>{part}</b> : part));
}

/** 筆算（百・十・一の3列）。ヒントに合わせて位を光らせ、くり上がり・くり下がりの印を書く */
function Hissan({ problem: p, shown, visual, state }: { problem: Problem; shown: string; visual: HintVisual | null; state: ViewState }) {
  const places = [100, 10, 1] as const;
  const hot = (place: number) =>
    (visual === "ones_highlight" && place === 1) ||
    (visual === "tens_highlight" && place === 10) ||
    (visual === "hundreds_highlight" && place === 100)
      ? "hot"
      : "";

  // 上の段の小さな印
  const marks: Record<number, string> = {};
  const struck = new Set<number>();
  if (visual === "carry_mark" && p.kind === "add") {
    let carry = 0;
    for (const place of [1, 10] as const) {
      const sum = digit(p.a, place) + digit(p.b, place) + carry;
      carry = sum >= 10 ? 1 : 0;
      if (carry) marks[place * 10] = "1";
    }
  }
  if (visual === "borrow_mark" && p.kind === "sub") {
    let borrowIn = 0;
    const top = places.map((pl) => digit(p.a, pl)).reverse(); // 一・十・百
    const bottom = places.map((pl) => digit(p.b, pl)).reverse();
    [1, 10, 100].forEach((place, i) => {
      let t = top[i] - borrowIn;
      borrowIn = 0;
      if (t < bottom[i]) {
        t += 10;
        borrowIn = 1;
      }
      if (t !== top[i]) {
        marks[place] = String(t);
        struck.add(place);
      }
    });
  }

  const cell = (n: number, place: number, show: boolean) => (show ? String(digit(n, place as 1 | 10 | 100)) : "");
  const answerDigits = shown.padStart(4, " ").slice(-4).split("");

  return (
    <div className="hissan" aria-label={`${p.a} ${opSymbol(p)} ${p.b}`}>
      <div className="h-row marks">
        <span />
        {places.map((pl) => (
          <span key={pl} className="cell">{marks[pl] ? <em>{marks[pl]}</em> : ""}</span>
        ))}
      </div>
      <div className="h-row">
        <span />
        {places.map((pl) => (
          <span key={pl} className={`cell ${hot(pl)}`}>
            {struck.has(pl) ? <s>{cell(p.a, pl, p.a >= pl)}</s> : cell(p.a, pl, p.a >= pl)}
          </span>
        ))}
      </div>
      <div className="h-row">
        {/* 記号は、下の数のいちばん上の位のすぐ左に書く（教科書と同じ） */}
        <span className="op">{p.b >= 100 ? opSymbol(p) : ""}</span>
        {places.map((pl) => {
          const opHere = p.b < 100 && ((pl === 100 && p.b >= 10) || (pl === 10 && p.b < 10));
          return (
            <span key={pl} className={`cell ${hot(pl)} ${opHere ? "op" : ""}`}>
              {opHere ? opSymbol(p) : cell(p.b, pl, p.b >= pl)}
            </span>
          );
        })}
      </div>
      <div className="h-rule" />
      <div className={`h-row result ${state}`}>
        {/* 4けたに なった とき（くり上がりの まちがい など）は、記号の 列に 千のくらいを 出す */}
        <span className="cell extra">{answerDigits[0].trim()}</span>
        {places.map((pl, i) => (
          <span key={pl} className={`cell ${hot(pl)}`}>{answerDigits[i + 1].trim()}</span>
        ))}
        {state === "correct" && <RedCircle />}
      </div>
    </div>
  );
}

/** かけ算の図：n が m こ分 */
function DotArray({ n, m }: { n: number; m: number }) {
  return (
    <div className="dots" aria-label={`${n}が ${m}こ分`}>
      {Array.from({ length: m }, (_, r) => (
        <div key={r} className="dot-row">
          <span className="dot-group">
            {Array.from({ length: n }, (_, c) => (
              <span key={c} className="dot" />
            ))}
          </span>
          <b>{r + 1}</b>
        </div>
      ))}
    </div>
  );
}

/** 1m = 100cm のテープ */
function MeterTape({ m }: { m: number }) {
  return (
    <div className="tape" aria-label={`1mは 100cm、${m}mぶん`}>
      {Array.from({ length: m }, (_, i) => (
        <div key={i} className="tape-seg">
          <span className="ticks" />
          <b>1m ＝ 100cm</b>
        </div>
      ))}
      <div className="tape-seg rest">
        <b>のこり</b>
      </div>
    </div>
  );
}

/** 国語の問題 */
function JapaneseView({ problem: p, step, state }: { problem: Problem; step: number; state: ViewState }) {
  const jp = p.jp!;
  const done = state !== "answering";
  const correctText = p.steps[step].choices?.[p.steps[step].answer] ?? "";
  const split = (sentence: string, key: string) => {
    const [before, after = ""] = sentence.split(key);
    return [before, after];
  };

  switch (p.layout) {
    case "kanji_read": {
      const [before, after] = split(jp.sentence!, "{word}");
      return (
        <div className="jp">
          <p className="jp-sentence">
            {before}
            {done ? (
              <ruby className={`target ${state}`}>
                {jp.word}
                <rt>{correctText}</rt>
              </ruby>
            ) : (
              <span className="target">{jp.word}</span>
            )}
            {after}
          </p>
        </div>
      );
    }
    case "particle": {
      const [before, after] = split(jp.sentence!, "{blank}");
      return (
        <div className="jp">
          <p className="jp-sentence">
            {before}
            <span className={`blank particle ${state}`}>{done ? correctText : "□"}</span>
            {after}
          </p>
        </div>
      );
    }
    case "kanji_write": {
      const [before, after] = split(jp.sentence!, "{blank}");
      return (
        <div className="jp">
          <p className="jp-sentence">
            {before}
            {done ? (
              <ruby className={`target filled ${state}`}>
                {correctText}
                <rt>{jp.reading}</rt>
              </ruby>
            ) : (
              <span className="blank">{jp.reading}</span>
            )}
            {after}
          </p>
        </div>
      );
    }
    case "katakana":
      return (
        <div className="jp katakana">
          <p className="jp-clue">{jp.clue}</p>
          <p className="jp-word">
            <span className="kana-from">{jp.reading}</span>
            <span className="arrow" aria-hidden="true">→</span>
            <span className={`kana-to ${state}`}>{done ? correctText : "？"}</span>
          </p>
        </div>
      );
    case "vocab":
      return (
        <div className="jp vocab">
          <p className="jp-ask">{jp.vocabType === "opposite" ? "はんたいの いみの ことば" : "なかまの ことば"}</p>
          <p className="jp-word">
            <span className="vocab-word">{jp.word}</span>
            <span className="arrow" aria-hidden="true">{jp.vocabType === "opposite" ? "⇔" : "の なかま"}</span>
            <span className={`kana-to ${state}`}>{done ? correctText : "？"}</span>
          </p>
        </div>
      );
    case "grammar": {
      const words = jp.sentence!.split(/(\s+)/);
      return (
        <div className="jp">
          <p className="jp-ask">{jp.ask === "subject" ? "だれが（なにが）" : "どうする（どんなだ・なんだ）"}</p>
          <p className="jp-sentence phrases">
            {words.map((w, i) =>
              /^\s+$/.test(w) ? (
                " "
              ) : (
                <span key={i} className={`phrase ${done && w.replace(/[。、]/g, "") === correctText.replace(/[。、]/g, "") ? `hit ${state}` : ""}`}>
                  {w}
                </span>
              ),
            )}
          </p>
        </div>
      );
    }
    default: {
      // 読みとり：教科書のように たて書き
      const paragraphs = (jp.passage ?? "").split("\n").filter(Boolean);
      return (
        <div className="reading">
          <div className="reading-head">
            <button className="listen" onClick={() => speak(`${jp.title}。 ${paragraphs.join(" ")}`)}>
              <SpeakerIcon size={20} /> ぶんしょうを きく
            </button>
            <ol className="q-dots" aria-label={`もんだい ${step + 1} / ${p.steps.length}`}>
              {p.steps.map((_, i) => (
                <li key={i} className={i < step || (done && i === step) ? "done" : i === step ? "now" : ""}>
                  {i + 1}
                </li>
              ))}
            </ol>
          </div>
          <div className="reading-body" tabIndex={0}>
            <h3>{jp.title}</h3>
            {paragraphs.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </div>
      );
    }
  }
}
