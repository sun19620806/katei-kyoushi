import { useEffect, useState } from "react";
import { DEFAULT_PROFILE, currentStreak, db, exportData, loadModel, saveProfile } from "../../db/db";
import { SKILLS, misconceptionLabel, skill } from "../../domain/content";
import { addDays, ymd } from "../../domain/dates";
import { activeStumbles, masterySymbol } from "../../domain/learner";
import { planLesson } from "../../domain/planner";
import { uid } from "../../domain/random";
import type { AnswerEvent, Episode, Profile, SessionEvent, SkillState, Stumble } from "../../domain/types";
import { speak } from "../speech";

type Tab = "today" | "map" | "log" | "settings";

interface Data {
  states: Record<string, SkillState>;
  stumbles: Record<string, Stumble>;
  answers: AnswerEvent[];
  sessions: SessionEvent[];
  episodes: Episode[];
  streak: number;
}

export default function Parent({ profile, onProfileChange, onExit }: { profile: Profile; onProfileChange: () => void; onExit: () => void }) {
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<Data | null>(null);

  const load = async () => {
    const [model, events, episodes, streak] = await Promise.all([
      loadModel(),
      db.events.orderBy("at").toArray(),
      db.episodes.orderBy("date").reverse().toArray(),
      currentStreak(),
    ]);
    setData({
      ...model,
      answers: events.filter((e): e is AnswerEvent => e.type === "answer"),
      sessions: events.filter((e): e is SessionEvent => e.type === "session"),
      episodes,
      streak,
    });
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="parent">
      <header className="parent-head">
        <h1>{profile.name}さんの学習ノート</h1>
        <button className="btn ghost" onClick={onExit}>
          子どもの画面へ
        </button>
      </header>
      <nav className="tabs">
        {(
          [
            ["today", "今日と今週"],
            ["map", "スキルマップ"],
            ["log", "記録"],
            ["settings", "設定"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>
      {!data ? null : tab === "today" ? (
        <Today data={data} profile={profile} />
      ) : tab === "map" ? (
        <SkillMap data={data} profile={profile} onProfileChange={onProfileChange} />
      ) : tab === "log" ? (
        <Log data={data} />
      ) : (
        <Settings profile={profile} onProfileChange={onProfileChange} onDataChange={load} />
      )}
    </main>
  );
}

function Today({ data, profile }: { data: Data; profile: Profile }) {
  const today = ymd();
  const weekAgo = addDays(today, -6);
  const todays = data.answers.filter((a) => a.at.slice(0, 10) === today && a.attemptNo === 1);
  const minutes = data.sessions
    .filter((s) => s.kind === "finish" && s.at.slice(0, 10) === today)
    .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  const noHint = todays.filter((a) => a.correct && a.hintLevel === 0).length;
  const hinted = new Set(data.answers.filter((a) => a.at.slice(0, 10) === today && a.hintLevel > 0).map((a) => a.problem.id)).size;
  const weekEpisodes = data.episodes.filter((e) => e.date >= weekAgo);
  const stumbles = activeStumbles(data.stumbles, today).sort((a, b) => (a.status === "confirmed" ? -1 : 1) - (b.status === "confirmed" ? -1 : 1));
  const plan = planLesson({ profile, states: data.states, stumbles: data.stumbles, mood: "futsu", today });
  const moods = data.sessions.filter((s) => s.kind === "start" && s.mood && s.at.slice(0, 10) >= addDays(today, -2)).map((s) => s.mood);
  const tiredStreak = moods.length >= 2 && moods.slice(-2).every((m) => m === "tsukare");

  return (
    <div className="panel-grid">
      <section className="panel wide">
        <h2>今日の連絡帳</h2>
        {todays.length === 0 ? (
          <p>今日はまだ学習していません。{data.streak > 0 && `（現在 ${data.streak}日連続）`}</p>
        ) : (
          <p className="note-text">
            今日は約{Math.max(1, minutes)}分、{todays.length}問に取り組みました。ヒントなしで解けたのは{noHint}問、ヒントを使ったのは{hinted}問です。
            {weekEpisodes[0] && `「${weekEpisodes[0].text}」ことが最近の成長です。`}
            {stumbles[0] && `いまは「${misconceptionLabel(stumbles[0].misconception)}」（${skill(stumbles[0].skillId).label}）が見られます。`}
            {data.streak >= 2 && `${data.streak}日連続で続いています。`}
          </p>
        )}
        {tiredStreak && <p className="alert">気分チェックで「つかれた」が続いています。お子さんの様子を見てあげてください。</p>}
      </section>

      <section className="panel">
        <h2>今週できるようになったこと</h2>
        {weekEpisodes.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className="list">
            {weekEpisodes.slice(0, 8).map((e) => (
              <li key={e.id}>
                <span className="date">{e.date.slice(5).replace("-", "/")}</span>
                {e.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>つまずいていること</h2>
        {stumbles.length === 0 ? (
          <p className="muted">いまは特にありません。</p>
        ) : (
          <ul className="list">
            {stumbles.slice(0, 6).map((s) => (
              <li key={s.key}>
                <span className={`chip ${s.status}`}>{s.status === "confirmed" ? "くり返し" : "1回"}</span>
                {misconceptionLabel(s.misconception)}
                <small>{skill(s.skillId).label}</small>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">同じ間違い方が違う問題で2回出ると「くり返し」、その後ヒントなしで3回続けて解けると解消します。</p>
      </section>

      <section className="panel">
        <h2>次の授業の予定</h2>
        <p>
          重点：<b>{skill(plan.focusSkill).label}</b>
        </p>
        <ul className="list">
          {[...new Set(plan.items.filter((i) => i.phase === "review").map((i) => i.skillId))].map((id) => (
            <li key={id}>復習：{skill(id).label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SkillMap({ data, profile, onProfileChange }: { data: Data; profile: Profile; onProfileChange: () => void }) {
  const groups = [
    { title: "たし算・ひき算", ids: SKILLS.filter((s) => !s.id.startsWith("math.mul")).map((s) => s.id) },
    { title: "九九", ids: SKILLS.filter((s) => s.id.startsWith("math.mul")).map((s) => s.id) },
  ];
  const toggle = async (id: string) => {
    const enabled = profile.enabledSkills.includes(id) ? profile.enabledSkills.filter((x) => x !== id) : [...profile.enabledSkills, id];
    if (enabled.length === 0) return;
    await saveProfile({ ...profile, enabledSkills: enabled });
    onProfileChange();
  };
  return (
    <div className="panel-grid">
      {groups.map((g) => (
        <section className="panel" key={g.title}>
          <h2>{g.title}</h2>
          <table className="skills">
            <tbody>
              {g.ids.map((id) => {
                const s = data.states[id];
                const on = profile.enabledSkills.includes(id);
                return (
                  <tr key={id} className={on ? "" : "off"}>
                    <td className="sym">{masterySymbol(s)}</td>
                    <td>
                      {skill(id).label}
                      <div className="bar">
                        <span style={{ width: `${Math.round((s?.mastery ?? 0) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="num">{s?.attempts ?? 0}問</td>
                    <td className="num small">{s?.nextReview ? `復習 ${s.nextReview.slice(5).replace("-", "/")}` : ""}</td>
                    <td>
                      <label className="switch">
                        <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                        出す
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
      <p className="muted small wide">◎ 身についた　○ だいたいできる　△ 練習中　− まだ　／「出す」を外すと授業に出なくなります（学校でまだ習っていない単元など）。</p>
    </div>
  );
}

function Log({ data }: { data: Data }) {
  const bySession = new Map<string, AnswerEvent[]>();
  for (const a of [...data.answers].reverse()) {
    const list = bySession.get(a.sessionId) ?? [];
    list.push(a);
    bySession.set(a.sessionId, list);
  }
  const sessions = [...bySession.entries()].slice(0, 10);
  const op = (a: AnswerEvent) => (a.problem.kind === "add" ? "+" : a.problem.kind === "sub" ? "−" : "×");
  return (
    <div className="panel-grid">
      {sessions.length === 0 && <p className="muted">まだ記録がありません。</p>}
      {sessions.map(([id, answers]) => (
        <section className="panel wide" key={id}>
          <h2>{new Date(answers[0].at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</h2>
          <div className="table-wrap">
            <table className="log">
              <thead>
                <tr>
                  <th>問題</th>
                  <th>答え</th>
                  <th>結果</th>
                  <th>ヒント</th>
                  <th>推定した原因</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {[...answers].reverse().map((a) => (
                  <tr key={a.id}>
                    <td className="num">
                      {a.problem.a} {op(a)} {a.problem.b}
                    </td>
                    <td className="num">{a.given}</td>
                    <td>{a.correct ? "○" : "×"}</td>
                    <td className="num">{a.hintLevel || ""}</td>
                    <td>{a.misconception ? (a.misconception === "unknown" ? "不明" : misconceptionLabel(a.misconception)) : ""}</td>
                    <td className="num">{Math.round(a.ms / 1000)}秒</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Settings({ profile, onProfileChange, onDataChange }: { profile: Profile; onProfileChange: () => void; onDataChange: () => void }) {
  const [p, setP] = useState(profile);
  const [episode, setEpisode] = useState("");
  const [saved, setSaved] = useState("");
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  const save = async () => {
    await saveProfile(p);
    onProfileChange();
    setSaved("保存しました。");
  };

  const addEpisode = async () => {
    if (!episode.trim()) return;
    await db.episodes.put({ id: uid(), date: ymd(), kind: "parent", text: episode.trim() });
    setEpisode("");
    onDataChange();
    setSaved("思い出を追加しました。先生があいさつで話します。");
  };

  const download = async () => {
    const json = JSON.stringify(await exportData(), null, 2);
    const file = new File([json], `katei-kyoushi-${ymd()}.json`, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => undefined);
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  const resetAll = async () => {
    if (!confirm("学習の記録をすべて消します。元に戻せません。先に「記録を書き出す」でバックアップすることをおすすめします。消しますか？")) return;
    await Promise.all([db.events.clear(), db.skillStates.clear(), db.stumbles.clear(), db.episodes.clear(), db.lineUsage.clear()]);
    onDataChange();
    setSaved("記録を消しました。");
  };

  return (
    <div className="panel-grid">
      <section className="panel">
        <h2>お子さんと先生</h2>
        <label>呼び名<input value={p.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>呼び名のよみ（ひらがな）<input value={p.nameYomi} onChange={(e) => set("nameYomi", e.target.value)} /></label>
        <label>先生の名前<input value={p.teacherName} onChange={(e) => set("teacherName", e.target.value)} /></label>
        <label>
          好きなもの（「、」で区切る）
          <input value={p.favorites.join("、")} onChange={(e) => set("favorites", e.target.value.split(/[、,]/).map((x) => x.trim()).filter(Boolean))} />
        </label>
      </section>

      <section className="panel">
        <h2>授業</h2>
        <label>1回の問題数<input type="number" min={5} max={20} value={p.problemsPerSession} onChange={(e) => set("problemsPerSession", Number(e.target.value) || DEFAULT_PROFILE.problemsPerSession)} /></label>
        <label>1回の上限（分）<input type="number" min={5} max={30} value={p.maxMinutes} onChange={(e) => set("maxMinutes", Number(e.target.value) || DEFAULT_PROFILE.maxMinutes)} /></label>
        <div className="row">
          <label>使える時間（から）<input type="time" value={p.allowedFrom} onChange={(e) => set("allowedFrom", e.target.value)} /></label>
          <label>（まで）<input type="time" value={p.allowedTo} onChange={(e) => set("allowedTo", e.target.value)} /></label>
        </div>
        <label className="switch"><input type="checkbox" checked={p.speech} onChange={(e) => set("speech", e.target.checked)} />先生の声で読み上げる</label>
        <label>読み上げの速さ<input type="range" min={0.7} max={1.3} step={0.05} value={p.speechRate} onChange={(e) => set("speechRate", Number(e.target.value))} /></label>
        <button className="btn ghost" onClick={() => speak(`${p.nameYomi || p.name}、こんにちは。ぼくは ${p.teacherName}。`)}>声を試す</button>
        <label>暗証番号（4けた）<input inputMode="numeric" value={p.parentPin} onChange={(e) => set("parentPin", e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <button className="btn primary" onClick={save} disabled={!/^\d{4}$/.test(p.parentPin)}>設定を保存</button>
      </section>

      <section className="panel">
        <h2>思い出を足す</h2>
        <p className="muted small">家での出来事を一言入れると、先生があいさつで話題にします。住所や学校名などは入れないでください。</p>
        <label>出来事（「〜た」で終える）<input value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="例：プールで 25メートル およげた" /></label>
        <button className="btn ghost" onClick={addEpisode}>追加</button>
      </section>

      <section className="panel">
        <h2>データ</h2>
        <p className="muted small">記録はこのiPadの中だけにあります。週1回の先生会議の前と、月に1回のバックアップに書き出してください。呼び名と暗証番号は含まれません。</p>
        <button className="btn primary" onClick={download}>記録を書き出す</button>
        <button className="btn danger" onClick={resetAll}>記録をすべて消す</button>
      </section>
      {saved && <p className="toast wide">{saved}</p>}
    </div>
  );
}
