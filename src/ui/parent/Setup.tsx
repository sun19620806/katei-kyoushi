import { useState } from "react";
import { DEFAULT_PROFILE, saveProfile } from "../../db/db";

/** はじめての設定（おうちの人が行う） */
export default function Setup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [yomi, setYomi] = useState("");
  const [teacher, setTeacher] = useState(DEFAULT_PROFILE.teacherName);
  const [pin, setPin] = useState("");
  const valid = name.trim() && /^[ぁ-んー]+$/.test(yomi.trim()) && /^\d{4}$/.test(pin);

  const submit = async () => {
    if (!valid) return;
    await saveProfile({ ...DEFAULT_PROFILE, name: name.trim(), nameYomi: yomi.trim(), teacherName: teacher.trim() || "ノート", parentPin: pin });
    onDone();
  };

  return (
    <main className="parent setup">
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
      <button className="btn primary" disabled={!valid} onClick={submit}>
        はじめる
      </button>
      {!valid && <p className="note">呼び名・ひらがなのよみ・4けたの数字を入れると進めます。</p>}
    </main>
  );
}
