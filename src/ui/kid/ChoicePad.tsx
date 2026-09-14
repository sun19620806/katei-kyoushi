interface Props {
  choices: string[];
  onPick: (index: number) => void;
  disabled?: boolean;
}

/** 式などを選ぶ大きなカード */
export default function ChoicePad({ choices, onPick, disabled }: Props) {
  return (
    <div className="choicepad">
      {choices.map((c, i) => (
        <button key={c} disabled={disabled} onClick={() => onPick(i)}>
          {c}
        </button>
      ))}
    </div>
  );
}
