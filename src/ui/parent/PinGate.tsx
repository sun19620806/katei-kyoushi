import { useEffect, useState } from "react";

const LOCK_KEY = "pin-forgot-lock";
const makeQuestion = () => {
  const a = 123 + Math.floor(Math.random() * 800);
  const b = 23 + Math.floor(Math.random() * 70);
  return { a, b, answer: a * b };
};
const lockedUntil = () => {
  try {
    return Number(localStorage.getItem(LOCK_KEY) ?? 0);
  } catch {
    return 0;
  }
};

/**
 * おうちの人の暗証番号。
 * わすれたときは、3けた×2けたの かけ算（小2では まだ とけない）で 入れる。まちがえる たびに 問題が かわり、3回で 5分 まつ。
 */
export default function PinGate({ pin, onOk, onCancel }: { pin: string; onOk: () => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const [miss, setMiss] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [question, setQuestion] = useState(makeQuestion);
  const [misses, setMisses] = useState(0);
  const [, setTick] = useState(0);
  const locked = forgot && lockedUntil() > Date.now();
  // まつ 時間が おわったら 押せるように もどす（つぎの 3回を また かぞえる）
  useEffect(() => {
    if (!locked) return;
    const t = setTimeout(() => {
      setMisses(0);
      setMiss(false);
      setTick((n) => n + 1);
    }, Math.max(0, lockedUntil() - Date.now()) + 200);
    return () => clearTimeout(t);
  }, [locked]);

  const target = forgot ? String(question.answer) : pin;
  const length = target.length;

  const press = (d: string) => {
    const v = (value + d).slice(0, length);
    setValue(v);
    if (v.length === length) {
      if (v === target) onOk();
      else {
        setMiss(true);
        setValue("");
        if (forgot) {
          const m = misses + 1;
          setMisses(m);
          setQuestion(makeQuestion());
          if (m >= 3) {
            setMisses(0);
            try {
              localStorage.setItem(LOCK_KEY, String(Date.now() + 5 * 60 * 1000));
            } catch {
              /* 保存できなくても つづける */
            }
          }
        }
      }
    }
  };

  return (
    <main className="parent pin">
      <h1>おうちの人のページ</h1>
      <p className="lead">
        {locked
          ? "しばらく待ってから、もう一度ためしてください。"
          : forgot
          ? `${question.a} × ${question.b} の答えを入力してください。`
          : miss
            ? "番号が一致しません。もう一度入力してください。"
            : "暗証番号を入力してください。"}
      </p>
      <div className="pin-dots" aria-label={`${value.length}けた入力済み`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < value.length ? "on" : ""} />
        ))}
      </div>
      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={locked}>
            {d}
          </button>
        ))}
        <button onClick={onCancel} className="ghost">
          もどる
        </button>
        <button onClick={() => press("0")} disabled={locked}>0</button>
        <button onClick={() => setValue(value.slice(0, -1))} className="ghost">
          けす
        </button>
      </div>
      {!forgot && (
        <button
          className="btn ghost forgot"
          onClick={() => {
            setForgot(true);
            setValue("");
            setMiss(false);
          }}
        >
          暗証番号をわすれた
        </button>
      )}
      {forgot && <p className="muted small">入ったあと「設定」で新しい暗証番号にできます。</p>}
    </main>
  );
}
