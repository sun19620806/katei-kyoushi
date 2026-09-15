import { ChoiceVisual } from "./visuals";

interface Props {
  choices: string[];
  onPick: (index: number) => void;
  disabled?: boolean;
  eliminated?: number[];
  correct?: number; // 答えを見せるとき、正解を 色で しめす
}

/** 式・ことば・図を選ぶ大きなカード */
export default function ChoicePad({ choices, onPick, disabled, eliminated = [], correct }: Props) {
  const visual = choices.some((c) => c.startsWith("shape:") || c.startsWith("frac:"));
  const long = !visual && choices.some((c) => c.length > 6);
  return (
    <div className={`choicepad ${visual ? "visual" : ""} ${long ? "long" : ""}`}>
      {choices.map((c, i) => (
        <button
          key={c}
          className={i === correct ? "right" : eliminated.includes(i) ? "out" : ""}
          disabled={disabled || eliminated.includes(i)}
          onClick={() => onPick(i)}
          aria-label={visual ? `${i + 1}ばん` : c}
        >
          {visual ? (
            <>
              <ChoiceVisual code={c} />
              <small>{i + 1}</small>
            </>
          ) : (
            c
          )}
        </button>
      ))}
    </div>
  );
}
