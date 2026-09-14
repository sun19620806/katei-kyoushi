import { useEffect, useState } from "react";
import { currentStreak, db, loadModel, studyDays } from "../../db/db";
import { skill } from "../../domain/content";
import { ymd } from "../../domain/dates";
import { planLesson } from "../../domain/planner";
import type { Profile } from "../../domain/types";
import { ArrowIcon } from "../icons";
import Teacher from "../Teacher";
import WeekStamps from "./WeekStamps";

export function withinHours(p: Profile, now = new Date()) {
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return hm >= p.allowedFrom && hm <= p.allowedTo;
}

export default function Home({ profile, onStart, onParent }: { profile: Profile; onStart: () => void; onParent: () => void }) {
  const [streak, setStreak] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const [first, setFirst] = useState(true);
  const [focus, setFocus] = useState<string[]>([]);
  const open = withinHours(profile);
  const doneToday = days.includes(ymd());

  useEffect(() => {
    (async () => {
      const [s, d, count, model] = await Promise.all([currentStreak(), studyDays(), db.events.count(), loadModel()]);
      setStreak(s);
      setDays(d);
      setFirst(count === 0);
      setFocus(planLesson({ profile, ...model, mood: "futsu", today: ymd() }).focusSkills);
    })();
  }, [profile]);

  return (
    <main className="kid home">
      <section className="home-teacher">
        <Teacher face={open ? "smile" : "calm"} size={200} />
        <p className="home-bubble">
          {!open
            ? `いまは おやすみの じかん。${profile.allowedFrom.replace(/^0/, "")}から あえるよ。`
            : first
              ? `はじめまして、${profile.name}。`
              : doneToday
                ? `きょうも やったね、${profile.name}。`
                : `${profile.name}、まってたよ。`}
        </p>
      </section>

      <section className="home-card">
        <p className="home-teacher-name">{profile.teacherName} せんせいの きょうしつ</p>
        {focus.length > 0 && open && (
          <div className="menu">
            <small>きょうの メイン</small>
            {focus.map((id) => (
              <b key={id}>
                <em>{skill(id).subject === "japanese" ? "こくご" : "さんすう"}</em>
                {skill(id).kidLabel}
              </b>
            ))}
          </div>
        )}
        <WeekStamps days={days} />
        {streak >= 2 && <p className="streak">{streak}にち れんぞく</p>}
        <button className="btn-start" onClick={onStart} disabled={!open}>
          {doneToday ? "もういちど やる" : "はじめる"}
          <ArrowIcon size={34} />
        </button>
      </section>

      <button className="parent-link" onClick={onParent}>
        おうちの ひと
      </button>
    </main>
  );
}
