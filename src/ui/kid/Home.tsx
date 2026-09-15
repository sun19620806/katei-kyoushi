import { useEffect, useState } from "react";
import { currentStreak, db, loadModel, studyDays } from "../../db/db";
import { SKILLS, skill } from "../../domain/content";
import { ymd } from "../../domain/dates";
import { UNLOCK_THRESHOLD } from "../../domain/learner";
import { planLesson } from "../../domain/planner";
import type { Episode, Profile } from "../../domain/types";
import { ArrowIcon } from "../icons";
import { unlockSpeech } from "../speech";
import { StickerIcon } from "../stickers";
import Teacher from "../Teacher";
import WeekStamps from "./WeekStamps";

export function withinHours(p: Profile, now = new Date()) {
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // 夜をまたぐ設定（例 21:00〜06:00）にも対応
  return p.allowedFrom <= p.allowedTo ? hm >= p.allowedFrom && hm <= p.allowedTo : hm >= p.allowedFrom || hm <= p.allowedTo;
}

interface Props {
  profile: Profile;
  onStart: () => void;
  onParent: () => void;
  onStickers: () => void;
  onMap: () => void;
  onTeacher: () => void;
}

export default function Home({ profile, onStart, onParent, onStickers, onMap, onTeacher }: Props) {
  const [streak, setStreak] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const [first, setFirst] = useState(true);
  const [focus, setFocus] = useState<string[]>([]);
  const [stickers, setStickers] = useState<Episode[]>([]);
  const [canCount, setCanCount] = useState(0);
  // 開いたままでも 時間に なったら 切りかわるように、ときどき たしかめる
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const open = withinHours(profile, now);
  const doneToday = days.includes(ymd(now));

  useEffect(() => {
    (async () => {
      const [s, d, count, model, eps] = await Promise.all([
        currentStreak(),
        studyDays(),
        db.events.count(),
        loadModel(),
        db.episodes.orderBy("date").reverse().toArray(),
      ]);
      setStreak(s);
      setDays(d);
      setFirst(count === 0);
      setStickers(eps);
      setCanCount(
        SKILLS.filter((k) => profile.subjects.includes(k.subject) && !profile.disabledSkills.includes(k.id) && (model.states[k.id]?.mastery ?? 0) >= UNLOCK_THRESHOLD).length,
      );
      setFocus(planLesson({ profile, ...model, mood: "futsu", today: ymd() }).focusSkills);
    })();
  }, [profile]);

  const message = !open
    ? `いまは おやすみの じかん。${profile.allowedFrom.replace(/^0/, "")}から あえるよ。`
    : first
      ? `はじめまして、${profile.name}。`
      : doneToday
        ? `きょうも やったね、${profile.name}。`
        : streak >= 2
          ? `${profile.name}、${streak}にち れんぞく。きょうも いこう。`
          : `${profile.name}、まってたよ。`;

  return (
    <main className="kid home">
      <button className="parent-link" onClick={onParent}>
        おうちの ひと
      </button>

      <section className="home-teacher">
        <button className="teacher-button" onClick={() => { unlockSpeech(); onTeacher(); }} aria-label="せんせいを えらぶ">
          <Teacher look={profile.teacherLook} face={open ? "smile" : "calm"} size={200} />
          <span className="teacher-tag">{profile.teacherName} せんせい</span>
        </button>
        <p className="home-bubble">{message}</p>
      </section>

      <section className="home-main">
        <div className="home-card">
          <div className="menu">
            <small>きょうの メイン</small>
            {open && focus.length > 0 ? (
              focus.map((id) => (
                <b key={id}>
                  <em>{skill(id).subject === "japanese" ? "こくご" : "さんすう"}</em>
                  {skill(id).kidLabel}
                </b>
              ))
            ) : (
              <b className="closed">また あとで</b>
            )}
          </div>
          <WeekStamps days={days} />
          <button className="btn-start" onClick={() => { unlockSpeech(); onStart(); }} disabled={!open}>
            {doneToday ? "もういちど やる" : "はじめる"}
            <ArrowIcon size={34} />
          </button>
        </div>

        <div className="home-tiles">
          <button className="tile" onClick={onStickers}>
            <span className="tile-art">
              {stickers.length > 0 ? (
                stickers.slice(0, 3).map((e, i) => (
                  <span key={e.id} style={{ rotate: `${(i - 1) * 12}deg`, marginLeft: i ? -26 : 0 }}>
                    <StickerIcon kind={e.kind} size={52} />
                  </span>
                ))
              ) : (
                <StickerIcon kind="first_no_hint" size={52} />
              )}
            </span>
            <b>シールちょう</b>
            <small>{stickers.length}まい</small>
          </button>
          <button className="tile" onClick={onMap}>
            <span className="tile-art map-art" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <i key={i} className={i < Math.min(6, canCount) ? "on" : ""} />
              ))}
            </span>
            <b>がくしゅうマップ</b>
            <small>できた {canCount}</small>
          </button>
        </div>
      </section>
    </main>
  );
}
