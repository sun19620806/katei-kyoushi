import { useEffect, useState } from "react";
import { db } from "../../db/db";
import { addDays, ymd } from "../../domain/dates";
import type { Episode, Profile } from "../../domain/types";
import { ArrowIcon } from "../icons";
import { StickerIcon, STICKER_NAME } from "../stickers";
import Teacher from "../Teacher";

/** シールちょう：できるように なった ことが シールに なって たまる */
export default function StickerBook({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);

  useEffect(() => {
    db.episodes.orderBy("date").reverse().toArray().then(setEpisodes);
  }, []);

  const today = ymd();
  const weekStart = addDays(today, -6);
  const week = (episodes ?? []).filter((e) => e.date >= weekStart);

  return (
    <main className="kid subpage">
      <header className="sub-head">
        <button className="back" onClick={onBack}>
          <span className="flip">
            <ArrowIcon size={22} />
          </span>
          もどる
        </button>
        <h1>シールちょう</h1>
        <span className="count-badge">{episodes?.length ?? 0}まい</span>
      </header>

      {episodes && episodes.length === 0 && (
        <section className="empty">
          <Teacher look={profile.teacherLook} face="smile" size={120} />
          <p>べんきょうして、できる ことが ふえると シールが もらえるよ。</p>
        </section>
      )}

      {week.length > 0 && (
        <section className="week-card">
          <p className="week-title">この 1しゅうかんで {week.length}まい</p>
          <div className="sticker-row">
            {week.slice(0, 8).map((e) => (
              <StickerIcon key={e.id} kind={e.kind} size={56} />
            ))}
          </div>
        </section>
      )}

      {episodes && episodes.length > 0 && (
        <ul className="sticker-grid">
          {episodes.map((e, i) => (
            <li key={e.id} style={{ rotate: `${((i * 37) % 9) - 4}deg` }}>
              <StickerIcon kind={e.kind} />
              <b>{STICKER_NAME[e.kind]}</b>
              <span>{e.text}</span>
              <small>
                {Number(e.date.slice(5, 7))}がつ {Number(e.date.slice(8, 10))}にち
              </small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
