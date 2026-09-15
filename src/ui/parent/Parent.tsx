import { useEffect, useState } from "react";
import { DEFAULT_PROFILE, currentStreak, db, exportData, loadModel, saveProfile } from "../../db/db";
import { SKILLS, SKILL_GROUPS, hasSkill, misconceptionLabel, skill } from "../../domain/content";
import { addDays, localDay, ymd } from "../../domain/dates";
import { activeStumbles, masterySymbol } from "../../domain/learner";
import { planLesson } from "../../domain/planner";
import { uid } from "../../domain/random";
import type { AnswerEvent, Episode, Profile, SessionEvent, SkillState, Stumble } from "../../domain/types";
import { speak, unlockSpeech } from "../speech";

type Tab = "today" | "map" | "log" | "settings";

interface Data {
  states: Record<string, SkillState>;
  stumbles: Record<string, Stumble>;
  answers: AnswerEvent[];
  sessions: SessionEvent[];
  episodes: Episode[];
  streak: number;
}

interface ParentProps {
  profile: Profile;
  onProfileChange: () => void;
  onExit: () => void;
  onTrial: (skillId: string) => void;
}

export default function Parent({ profile, onProfileChange, onExit, onTrial }: ParentProps) {
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem("parentTab") as Tab) || "today");
  useEffect(() => {
    sessionStorage.setItem("parentTab", tab);
  }, [tab]);
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
        <SkillMap data={data} profile={profile} onProfileChange={onProfileChange} onTrial={onTrial} />
      ) : tab === "log" ? (
        <Log data={data} />
      ) : (
        <Settings profile={profile} onProfileChange={onProfileChange} onDataChange={load} />
      )}
    </main>
  );
}

/** 回答の記録を 問題ごとに まとめる（読みとりの 3問・とけいの 時と分 も 1問と 数える） */
function problemsOn(answers: AnswerEvent[], day: string) {
  const byProblem = new Map<string, AnswerEvent[]>();
  for (const a of answers) {
    if (localDay(a.at) !== day) continue;
    byProblem.set(a.problem.id, [...(byProblem.get(a.problem.id) ?? []), a]);
  }
  const list = [...byProblem.values()];
  const ok = list.filter((evs) => evs.every((e) => e.correct && e.hintLevel === 0)).length;
  const hinted = list.filter((evs) => evs.some((e) => e.hintLevel > 0)).length;
  return { total: list.length, ok, hinted };
}

/** この7日間の 問題数（ヒントなし正解と、それ以外） */
function WeekChart({ data, today }: { data: Data; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rows = days.map((d) => {
    const { total, ok } = problemsOn(data.answers, d);
    const minutes = data.sessions.filter((s) => s.kind === "finish" && localDay(s.at) === d).reduce((m, s) => m + (s.minutes ?? 0), 0);
    return { d, ok, other: total - ok, minutes };
  });
  const max = Math.max(10, ...rows.map((r) => r.ok + r.other));
  const W = 560;
  const H = 150;
  const bw = 44;
  const gap = (W - 40 - bw * 7) / 6;
  const y = (v: number) => H - 24 - (v / max) * (H - 44);
  const week = ["日", "月", "火", "水", "木", "金", "土"];
  return (
    <section className="box wide week-chart">
      <h2>この7日間</h2>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="この7日間の 問題数">
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1="30" x2={W} y1={y(v)} y2={y(v)} stroke="var(--grid)" />
              <text x="24" y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">
                {Math.round(v)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const x = 40 + i * (bw + gap);
            const total = r.ok + r.other;
            return (
              <g key={r.d}>
                <rect x={x} y={y(total)} width={bw} height={y(0) - y(total)} rx="5" fill="var(--pencil-tint)" />
                <rect x={x} y={y(r.ok)} width={bw} height={y(0) - y(r.ok)} rx="5" fill="var(--pencil)" />
                {total > 0 && (
                  <text x={x + bw / 2} y={y(total) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">
                    {total}
                  </text>
                )}
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill={r.d === today ? "var(--ink)" : "var(--ink-3)"} fontWeight={r.d === today ? 700 : 400}>
                  {week[new Date(`${r.d}T12:00:00`).getDay()]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="legend small">
        <span><i className="swatch ok" />ヒントなしで正解</span>
        <span><i className="swatch other" />ヒントを使った・まちがえた</span>
        <span>合計 {rows.reduce((m, r) => m + r.minutes, 0)}分</span>
      </p>
    </section>
  );
}

function Today({ data, profile }: { data: Data; profile: Profile }) {
  const today = ymd();
  const weekAgo = addDays(today, -6);
  const counts = problemsOn(data.answers, today);
  const todays = { length: counts.total };
  const minutes = data.sessions
    .filter((s) => s.kind === "finish" && localDay(s.at) === today)
    .reduce((sum, s) => sum + (s.minutes ?? 0), 0);
  const noHint = counts.ok;
  const hinted = counts.hinted;
  const weekEpisodes = data.episodes.filter((e) => e.date >= weekAgo);
  const stumbles = activeStumbles(data.stumbles, today).filter((s) => hasSkill(s.skillId)).sort((a, b) => (a.status === "confirmed" ? -1 : 1) - (b.status === "confirmed" ? -1 : 1));
  const plan = planLesson({ profile, states: data.states, stumbles: data.stumbles, mood: "futsu", today });
  const moods = data.sessions.filter((s) => s.kind === "start" && s.mood && localDay(s.at) >= addDays(today, -2)).map((s) => s.mood);
  const tiredStreak = moods.length >= 2 && moods.slice(-2).every((m) => m === "tsukare");

  const firstTry = todays.length ? Math.round((noHint / todays.length) * 100) : 0;
  return (
    <div className="panel-grid">
      <section className="kpi-strip wide" aria-label="今日の数字">
        <div>
          <small>今日の学習</small>
          <b>{minutes}<span>分</span></b>
        </div>
        <div>
          <small>取り組んだ問題</small>
          <b>{todays.length}<span>問</span></b>
        </div>
        <div>
          <small>ヒントなしで正解</small>
          <b>{firstTry}<span>%</span></b>
        </div>
        <div>
          <small>連続</small>
          <b>{data.streak}<span>日</span></b>
        </div>
      </section>
      <WeekChart data={data} today={today} />
      <section className="box wide">
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

      <section className="box">
        <h2>今週できるようになったこと</h2>
        {weekEpisodes.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className="list">
            {weekEpisodes.slice(0, 8).map((e) => (
              <li key={e.id}>
                <span className="date">{e.date.slice(5).replace("-", "/")}</span>
                <span className="list-text">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="box">
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

      <section className="box">
        <h2>次の授業の予定</h2>
        <ul className="list">
          {plan.focusSkills.map((id) => (
            <li key={id}>
              <span className="chip">{skill(id).subject === "japanese" ? "国語" : "算数"}</span>
              <span className="list-text">重点：<b>{skill(id).label}</b></span>
            </li>
          ))}
        </ul>
        <ul className="list">
          {[...new Set(plan.items.filter((i) => i.phase === "review").map((i) => i.skillId))].map((id) => (
            <li key={id}>復習：{skill(id).label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SkillMap({ data, profile, onProfileChange, onTrial }: { data: Data; profile: Profile; onProfileChange: () => void; onTrial: (id: string) => void }) {
  const toggle = async (id: string) => {
    const off = profile.disabledSkills.includes(id);
    const disabledSkills = off ? profile.disabledSkills.filter((x) => x !== id) : [...profile.disabledSkills, id];
    const stillOn = SKILLS.filter((s) => profile.subjects.includes(s.subject) && !disabledSkills.includes(s.id));
    if (stillOn.length === 0) return; // 出す 単元が 1つも ない 状態には しない
    await saveProfile({ ...profile, disabledSkills });
    onProfileChange();
  };
  const SYM_TEXT: Record<string, string> = { "◎": "身についた", "○": "だいたいできる", "△": "練習中", "−": "まだ" };
  return (
    <div className="stack">
      <p className="legend">
        {Object.entries(SYM_TEXT).map(([sym, text]) => (
          <span key={sym}>
            <span className="sym-chip" data-s={sym}>{sym}</span>
            {text}
          </span>
        ))}
      </p>
      {SKILL_GROUPS.map((g) => (
        <section className="box" key={g}>
          <h2>{g}</h2>
          <ul className="skill-rows">
            {SKILLS.filter((s) => s.group === g).map(({ id }) => {
              const s = data.states[id];
              const on = !profile.disabledSkills.includes(id);
              const sym = masterySymbol(s);
              return (
                <li key={id} className={on ? "" : "off"}>
                  <span className="sym-chip" data-s={sym} title={SYM_TEXT[sym]}>
                    {sym}
                  </span>
                  <div className="skill-main">
                    <span className="skill-name">{skill(id).label}</span>
                    <div className="bar">
                      <span style={{ width: `${Math.round((s?.mastery ?? 0) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="skill-meta">
                    {s?.attempts ?? 0}問
                    {s?.nextReview && <small>復習 {s.nextReview.slice(5).replace("-", "/")}</small>}
                  </span>
                  <label className="toggle">
                    <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                    <span className="toggle-track" aria-hidden="true" />
                    <span className="toggle-label">{on ? "出す" : "出さない"}</span>
                  </label>
                  <button className="btn-mini" onClick={() => { unlockSpeech(); onTrial(id); }}>
                    ためす
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="muted small">
        ◎ は、日をあけた復習でも解けたときに付きます。学校でまだ習っていない単元は「出さない」にしてください。「1学期のふくしゅう」はウォームアップと復習にだけ出ます。「ためす」は3問だけ出して、記録は残しません。
      </p>
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
  const problemText = (a: AnswerEvent) => {
    const p = a.problem;
    switch (p.kind) {
      case "add": return `${p.a} + ${p.b}`;
      case "sub": return `${p.a} − ${p.b}`;
      case "mul": return `${p.a} × ${p.b}`;
      case "mul_missing": return `${p.a} × □ = ${p.product}`;
      case "mul_word": return a.step === 0 ? "文章題（式）" : `文章題 ${p.a} × ${p.b}`;
      case "len_to_cm": return `${p.a}m${p.b}cm = □cm`;
      case "len_to_mcm": return `${p.cm}cm = ${p.a}m□cm`;
      case "unit_to_small": return `${p.a}${p.unit?.big}${p.b}${p.unit?.small} = □${p.unit?.small}`;
      case "unit_to_mixed": return `${p.unit?.total}${p.unit?.small} = ${p.a}${p.unit?.big}□${p.unit?.small}`;
      case "clock_read": return `とけい ${p.clock?.h}時${p.clock?.m}分（${a.step === 0 ? "時" : "分"}）`;
      case "clock_shift": return `${p.clock?.h}時${p.clock?.m}分の${p.clock?.shift}分${p.clock?.dir === "before" ? "前" : "後"}（${a.step === 0 ? "時" : "分"}）`;
      case "fraction_of": return `${p.a}この1/${p.b}`;
      case "fraction_shape": return `1/${p.a}の図`;
      case "place_compose": return `4けたの数 ${p.b}`;
      case "shape_pick": return p.steps[0]?.prompt ?? "形";
      case "mul_rule": return p.rule === "step" ? `${p.a}×${p.b + 1}は${p.a}×${p.b}より□大きい` : `□×${p.a}=${p.a}×${p.b}`;
      case "compare": return `${p.a} □ ${p.b}`;
      case "addsub_word": return a.step === 0 ? "文章題（式）" : `文章題 ${p.a} ${p.addsub?.op === "add" ? "+" : "−"} ${p.b}`;
      case "jp_choice": return `${skill(p.skillId).label}：${p.jp?.word ?? p.jp?.reading ?? p.jp?.title ?? ""}`;
      default: return "";
    }
  };
  const givenText = (a: AnswerEvent) => {
    const st = a.problem.steps?.[a.step ?? 0];
    if (st?.type !== "choice") return String(a.given);
    const c = st.choices?.[a.given] ?? "";
    return c.startsWith("shape:") || c.startsWith("frac:") ? `${a.given + 1}ばんの図` : c;
  };
  return (
    <div className="panel-grid">
      {sessions.length === 0 && <p className="muted">まだ記録がありません。</p>}
      {sessions.map(([id, answers]) => (
        <section className="box wide" key={id}>
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
                    <td className="num">{problemText(a)}</td>
                    <td className="num">{givenText(a)}</td>
                    <td className={a.correct ? "okc" : "ng"}>{a.correct ? "○" : "×"}</td>
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
    const clamp = (v: number, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
    const time = (v: string, d: string) => (/^\d{2}:\d{2}$/.test(v) ? v : d);
    const fixed: Profile = {
      ...p,
      problemsPerSession: clamp(p.problemsPerSession, 5, 20, DEFAULT_PROFILE.problemsPerSession),
      maxMinutes: clamp(p.maxMinutes, 5, 40, DEFAULT_PROFILE.maxMinutes),
      allowedFrom: time(p.allowedFrom, DEFAULT_PROFILE.allowedFrom),
      allowedTo: time(p.allowedTo, DEFAULT_PROFILE.allowedTo),
    };
    setP(fixed);
    await saveProfile(fixed);
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

  // 書き出す ファイルは 先に 作っておく（iPad の「共有」は タップの すぐ あとで ないと ひらかないため）
  const [exportFile, setExportFile] = useState<File | null>(null);
  useEffect(() => {
    exportData()
      .then((data) => setExportFile(new File([JSON.stringify(data, null, 2)], `katei-kyoushi-${ymd()}.json`, { type: "application/json" })))
      .catch(() => setSaved("記録を準備できませんでした。ページを開き直してください。"));
  }, []);

  const download = () => {
    if (!exportFile) return;
    if (navigator.canShare?.({ files: [exportFile] })) {
      navigator.share({ files: [exportFile] }).catch((e: unknown) => {
        if (e instanceof Error && e.name !== "AbortError") setSaved(`書き出せませんでした（${e.message}）。`);
      });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(exportFile);
      a.download = exportFile.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setSaved("記録ファイルを書き出しました。");
    }
  };

  const resetAll = async () => {
    if (!confirm("学習の記録をすべて消します。元に戻せません。先に「記録を書き出す」でバックアップすることをおすすめします。消しますか？")) return;
    await db.transaction("rw", [db.events, db.skillStates, db.stumbles, db.episodes, db.lineUsage, db.ink], async () => {
      await Promise.all([db.events.clear(), db.skillStates.clear(), db.stumbles.clear(), db.episodes.clear(), db.lineUsage.clear(), db.ink.clear()]);
    });
    onDataChange();
    setSaved("記録を消しました。");
  };

  return (
    <div className="panel-grid">
      <section className="box">
        <h2>お子さんと先生</h2>
        <label>呼び名<input value={p.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>呼び名のよみ（ひらがな）<input value={p.nameYomi} onChange={(e) => set("nameYomi", e.target.value)} /></label>
        <label>先生の名前<input value={p.teacherName} onChange={(e) => set("teacherName", e.target.value)} /></label>
        <label>
          好きなもの（「、」で区切る）
          <input value={p.favorites.join("、")} onChange={(e) => set("favorites", e.target.value.split(/[、,]/).map((x) => x.trim()).filter(Boolean))} />
        </label>
      </section>

      <section className="box">
        <h2>授業</h2>
        <label>1回の問題数<input type="number" min={5} max={20} value={p.problemsPerSession} onChange={(e) => set("problemsPerSession", Number(e.target.value) || DEFAULT_PROFILE.problemsPerSession)} /></label>
        <label>1回の上限（分）<input type="number" min={5} max={30} value={p.maxMinutes} onChange={(e) => set("maxMinutes", Number(e.target.value) || DEFAULT_PROFILE.maxMinutes)} /></label>
        <div className="row">
          <label>使える時間（から）<input type="time" value={p.allowedFrom} onChange={(e) => set("allowedFrom", e.target.value)} /></label>
          <label>（まで）<input type="time" value={p.allowedTo} onChange={(e) => set("allowedTo", e.target.value)} /></label>
        </div>
        <div className="row">
          {(["math", "japanese"] as const).map((sub) => (
            <label key={sub} className="switch">
              <input
                type="checkbox"
                checked={p.subjects.includes(sub)}
                onChange={(e) => {
                  const next = e.target.checked ? [...p.subjects, sub] : p.subjects.filter((x) => x !== sub);
                  if (next.length) set("subjects", next);
                }}
              />
              {sub === "math" ? "算数を出す" : "国語を出す"}
            </label>
          ))}
        </div>
        <label className="switch"><input type="checkbox" checked={p.speech} onChange={(e) => set("speech", e.target.checked)} />先生の声で読み上げる</label>
        <label>読み上げの速さ<input type="range" min={0.7} max={1.3} step={0.05} value={p.speechRate} onChange={(e) => set("speechRate", Number(e.target.value))} /></label>
        <button className="btn ghost" onClick={() => speak(`${p.nameYomi || p.name}、こんにちは。ぼくは ${p.teacherName}。`)}>声を試す</button>
        <label>暗証番号（4けた）<input inputMode="numeric" value={p.parentPin} onChange={(e) => set("parentPin", e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <button className="btn primary" onClick={save} disabled={!/^\d{4}$/.test(p.parentPin)}>設定を保存</button>
      </section>

      <section className="box">
        <h2>思い出を足す</h2>
        <p className="muted small">家での出来事を一言入れると、先生があいさつで話題にします。住所や学校名などは入れないでください。</p>
        <label>出来事（「〜た」で終える）<input value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="例：プールで 25メートル およげた" /></label>
        <button className="btn ghost" onClick={addEpisode}>追加</button>
      </section>

      <section className="box">
        <h2>データ</h2>
        <p className="muted small">記録はこのiPadの中だけにあります。週1回の先生会議の前と、月に1回のバックアップに書き出してください。呼び名と暗証番号は含まれません。</p>
        <button className="btn primary" onClick={download} disabled={!exportFile}>{exportFile ? "記録を書き出す" : "準備中…"}</button>
        <button className="btn danger" onClick={resetAll}>記録をすべて消す</button>
      </section>
      {saved && <p className="toast wide">{saved}</p>}
    </div>
  );
}
