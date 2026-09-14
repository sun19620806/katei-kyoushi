import { useEffect, useState } from "react";
import { currentStreak, db } from "../../db/db";
import type { Profile } from "../../domain/types";
import Teacher from "../Teacher";

export function withinHours(p: Profile, now = new Date()) {
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return hm >= p.allowedFrom && hm <= p.allowedTo;
}

export default function Home({ profile, onStart, onParent }: { profile: Profile; onStart: () => void; onParent: () => void }) {
  const [streak, setStreak] = useState(0);
  const [sessions, setSessions] = useState(0);
  const open = withinHours(profile);

  useEffect(() => {
    currentStreak().then(setStreak);
    db.events.where("type").equals("session").count().then(setSessions);
  }, []);

  return (
    <main className="kid home">
      <button className="corner-link" onClick={onParent}>
        おうちの ひと
      </button>
      <div className="home-center">
        <Teacher face={open ? "smile" : "calm"} size={180} />
        <p className="home-name">{profile.teacherName} せんせい</p>
        {open ? (
          <button className="btn start" onClick={onStart}>
            {sessions === 0 ? "はじめる" : "きょうの べんきょう"}
          </button>
        ) : (
          <p className="bubble">いまは おやすみの じかん。{profile.allowedFrom.replace(/^0/, "")}から あえるよ。</p>
        )}
        {streak > 0 && <p className="streak">れんぞく {streak}にち</p>}
      </div>
    </main>
  );
}
