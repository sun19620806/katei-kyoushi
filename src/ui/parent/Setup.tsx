import { useState } from "react";
import { DEFAULT_PROFILE, saveProfile } from "../../db/db";
import { SKILL_GROUPS, SKILLS } from "../../domain/content";
import type { Profile } from "../../domain/types";

/** はじめての設定（おうちの人が行う）：① 呼び名と暗証番号 → ② 学校で習ったところ → ③ iPad の準備 */
export default function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [yomi, setYomi] = useState("");
  const [teacher, setTeacher] = useState(DEFAULT_PROFILE.teacherName);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<Profile["subjects"]>(["math", "japanese"]);
  const [offGroups, setOffGroups] = useState<string[]>([]);
  const valid = name.trim() && /^[ぁ-んー]+$/.test(yomi.trim()) && /^\d{4}$/.test(pin) && pin === pin2;

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    const disabledSkills = SKILLS.filter((s) => offGroups.includes(`${s.subject}:${s.group}`)).map((s) => s.id);
    try {
      await saveProfile({
        ...DEFAULT_PROFILE,
        name: name.trim(),
        nameYomi: yomi.trim(),
        teacherName: teacher.trim() || "ノート",
        parentPin: pin,
        subjects,
        disabledSkills,
      });
      onDone();
    } catch {
      setBusy(false);
      setError("保存できませんでした。iPad の空き容量と、Safari のプライベートブラウズでないかを確かめて、もう一度押してください。");
    }
  };

  const groups = (subject: "math" | "japanese") =>
    SKILL_GROUPS.filter((g) => SKILLS.some((s) => s.group === g && s.subject === subject && !s.review));

  return (
    <main className="parent setup">
      <p className="setup-steps" aria-label={`${step} / 3`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n === step ? "now" : n < step ? "done" : ""}>
            {n}
          </span>
        ))}
      </p>

      {step === 1 && (
        <>
          <h1>はじめの設定</h1>
          <p className="lead">おうちの方が入力してください。入力した内容はこのiPadの中だけに保存され、インターネットには送られません。</p>
          <label>
            お子さんの呼び名（画面に表示）
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：たろう" />
          </label>
          <label>
            呼び名のよみ（ひらがな・読み上げに使います）
            <input value={yomi} onChange={(e) => setYomi(e.target.value)} placeholder="例：たろう" />
          </label>
          <label>
            先生の名前（あとでお子さんと決めて変えられます）
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </label>
          <label>
            おうちの人用の暗証番号（数字4けた）
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" />
          </label>
          <label>
            もう一度（確認）
            <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" />
          </label>
          <button className="btn primary" disabled={!valid} onClick={() => setStep(2)}>
            つぎへ
          </button>
          {!valid && <p className="note">呼び名・ひらがなのよみ・4けたの暗証番号（2回同じもの）を入れると進めます。</p>}
        </>
      )}

      {step === 2 && (
        <>
          <h1>学校で習ったところ</h1>
          <p className="lead">まだ学校で習っていない単元は、外しておくと授業に出ません（その単元を使う先の単元も、習熟するまで出ません）。あとから「おうちの人のページ → スキルマップ」でいつでも変えられます。</p>
          <div className="row">
            {(["math", "japanese"] as const).map((sub) => (
              <label key={sub} className="switch">
                <input
                  type="checkbox"
                  checked={subjects.includes(sub)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...subjects, sub] : subjects.filter((x) => x !== sub);
                    if (next.length) setSubjects(next);
                  }}
                />
                {sub === "math" ? "算数を出す" : "国語を出す"}
              </label>
            ))}
          </div>
          {(["math", "japanese"] as const)
            .filter((sub) => subjects.includes(sub))
            .map((sub) => (
              <section key={sub} className="box setup-groups">
                <h2>{sub === "math" ? "算数" : "国語"}</h2>
                {groups(sub).map((g) => {
                  const key = `${sub}:${g}`;
                  const on = !offGroups.includes(key);
                  return (
                    <label key={key} className="toggle setup-toggle">
                      <input type="checkbox" checked={on} onChange={() => setOffGroups(on ? [...offGroups, key] : offGroups.filter((x) => x !== key))} />
                      <span className="toggle-track" aria-hidden="true" />
                      <span className="setup-group-name">{g}</span>
                      <small>{on ? "出す" : "まだ習っていない"}</small>
                    </label>
                  );
                })}
              </section>
            ))}
          <div className="row">
            <button className="btn ghost" onClick={() => setStep(1)}>
              もどる
            </button>
            <button className="btn primary" onClick={() => setStep(3)}>
              つぎへ
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1>iPad の準備</h1>
          <ol className="setup-guide">
            <li>
              <b>ホーム画面に追加</b>：Safari の共有ボタン →「ホーム画面に追加」。ホーム画面のアイコンから開くと、記録が消えにくくなります。
            </li>
            <li>
              <b>先生の声</b>：設定 → アクセシビリティ → 読み上げコンテンツ → 声 → 日本語 で、高品質の声をダウンロードすると聞きやすくなります。
            </li>
            <li>
              <b>音</b>：本体の消音スイッチ（または コントロールセンター）と音量を確認してください。
            </li>
            <li>
              <b>Apple Pencil</b>（あれば）：答えを入れる画面の「かく」で手書きできます。
            </li>
          </ol>
          <div className="row">
            <button className="btn ghost" onClick={() => setStep(2)}>
              もどる
            </button>
            <button className="btn primary" onClick={finish} disabled={busy}>
              はじめる
            </button>
          </div>
          {error && <p className="note">{error}</p>}
        </>
      )}
    </main>
  );
}
