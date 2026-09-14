import { useState } from "react";

export default function PinGate({ pin, onOk, onCancel }: { pin: string; onOk: () => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [miss, setMiss] = useState(false);

  const press = (d: string) => {
    const v = (value + d).slice(0, 4);
    setValue(v);
    if (v.length === 4) {
      if (v === pin) onOk();
      else {
        setMiss(true);
        setValue("");
      }
    }
  };

  return (
    <main className="parent pin">
      <h1>おうちの人のページ</h1>
      <p className="lead">{miss ? "番号が一致しません。もう一度入力してください。" : "暗証番号を入力してください。"}</p>
      <div className="pin-dots" aria-label={`${value.length}けた入力済み`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < value.length ? "on" : ""} />
        ))}
      </div>
      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button onClick={onCancel} className="ghost">
          もどる
        </button>
        <button onClick={() => press("0")}>0</button>
        <button onClick={() => setValue(value.slice(0, -1))} className="ghost">
          けす
        </button>
      </div>
    </main>
  );
}
