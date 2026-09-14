import { useState } from "react";
import { saveProfile } from "../../db/db";
import type { Profile } from "../../domain/types";
import { ArrowIcon } from "../icons";
import { speak } from "../speech";
import Teacher, { type TeacherLook } from "../Teacher";

const LOOKS: { look: TeacherLook; label: string; voice: string }[] = [
  { look: "note", label: "ノート", voice: "ぼくは ノートの せんせい。いっしょに かいて おぼえよう。" },
  { look: "pencil", label: "えんぴつ", voice: "ぼくは えんぴつの せんせい。どんどん かいて いこう。" },
  { look: "eraser", label: "けしごむ", voice: "ぼくは けしごむの せんせい。まちがえても だいじょうぶ。" },
];

/** 先生の見た目を子どもが選ぶ */
export default function TeacherPicker({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [look, setLook] = useState<TeacherLook>(profile.teacherLook ?? "note");

  const choose = (l: (typeof LOOKS)[number]) => {
    setLook(l.look);
    speak(l.voice);
  };

  const save = async () => {
    await saveProfile({ ...profile, teacherLook: look });
    onDone();
  };

  return (
    <main className="kid subpage">
      <header className="sub-head">
        <button className="back" onClick={onDone}>
          <span className="flip">
            <ArrowIcon size={22} />
          </span>
          もどる
        </button>
        <h1>せんせいを えらぼう</h1>
        <span />
      </header>
      <div className="look-cards">
        {LOOKS.map((l) => (
          <button key={l.look} className={`look-card ${look === l.look ? "on" : ""}`} onClick={() => choose(l)} aria-pressed={look === l.look}>
            <Teacher look={l.look} face={look === l.look ? "wow" : "smile"} size={150} />
            <b>{l.label}</b>
          </button>
        ))}
      </div>
      <p className="look-note">なまえは「{profile.teacherName} せんせい」だよ。</p>
      <button className="btn-start look-save" onClick={save}>
        この せんせいに する
        <ArrowIcon size={30} />
      </button>
    </main>
  );
}
