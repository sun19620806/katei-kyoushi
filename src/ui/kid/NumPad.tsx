interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function NumPad({ value, onChange, onSubmit, disabled }: Props) {
  const press = (d: string) => onChange((value + d).replace(/^0+(?=\d)/, "").slice(0, 3));
  return (
    <div className="numpad">
      {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((d) => (
        <button key={d} disabled={disabled} onClick={() => press(d)}>
          {d}
        </button>
      ))}
      <button className="erase" disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))}>
        けす
      </button>
      <button disabled={disabled} onClick={() => press("0")}>
        0
      </button>
      <button className="submit" disabled={disabled || !value} onClick={onSubmit}>
        こたえる
      </button>
    </div>
  );
}
