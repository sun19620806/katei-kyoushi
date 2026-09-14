import { useEffect, useRef, useState } from "react";
import {
  addEvent,
  currentStreak,
  db,
  loadModel,
  logLine,
  markEpisodeUsed,
  pickEpisode,
  recentLineKeys,
  saveSessionResult,
  studyDays,
} from "../../db/db";
import { skill } from "../../domain/content";
import { ymd } from "../../domain/dates";
import { finalizeSession } from "../../domain/finalize";
import { pickLine } from "../../domain/lines";
import { planLesson } from "../../domain/planner";
import { uid } from "../../domain/random";
import type { Episode, Mood, Profile, SkillState, Stumble } from "../../domain/types";
import {
  afterThink,
  answer,
  choose,
  currentPhase,
  type LessonState,
  next,
  requestHint,
  startLesson,
} from "../../engine/lesson";
import { speak, stopSpeaking } from "../speech";
import Teacher, { type Face } from "../Teacher";
import NumPad from "./NumPad";
import ProblemView, { problemSpeech } from "./ProblemView";

type Ui = "loading" | "mood" | "run" | "summary";

const THINK_CARDS: Record<string, string[]> = {
  add: ["10を つくった", "一のくらいから たした", "ゆびで かぞえた", "わからない"],
  sub: ["10を かりた", "たしざんで たしかめた", "なんとなく", "わからない"],
  mul: ["九九を となえた", "まえの こたえに たした", "おぼえていた", "わからない"],
};

interface Summary {
  count: number;
  lines: string[];
  growth: Episode[];
}

export default function Lesson({ profile, onExit }: { profile: Profile; onExit: () => void }) {
  const rng = Math.random;
  const [ui, setUi] = useState<Ui>("loading");
  const [bubble, setBubble] = useState("");
  const [face, setFace] = useState<Face>("smile");
  const [lesson, setLesson] = useState<LessonState | null>(null);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  const model = useRef<{ states: Record<string, SkillState>; stumbles: Record<string, Stumble> }>({ states: {}, stumbles: {} });
  const recent = useRef<string[]>([]);
  const lastSpeech = useRef("");
  const lastPhase = useRef("");
  const startedAt = useRef(Date.now());
  const sessionId = useRef(uid());

  const vars = { name: profile.name, teacher: profile.teacherName, favorite: profile.favorites[0] };
  const speechVars = { name: profile.nameYomi || profile.name };

  /** 場面のセリフを選ぶ（使った記録も残す） */
  const line = (scene: string, extra: Record<string, string | undefined> = {}) => {
    const l = pickLine(scene, { ...vars, ...extra }, recent.current, rng, speechVars);
    if (!l) return { display: "", speech: "" };
    recent.current = [l.key, ...recent.current].slice(0, 40);
    logLine(l.key);
    return l;
  };

  const show = (parts: { display: string; speech: string }[], f: Face = "smile") => {
    const display = parts.map((p) => p.display).filter(Boolean).join(" ");
    const speech = parts.map((p) => p.speech).filter(Boolean).join("。 ");
    setBubble(display);
    setFace(f);
    lastSpeech.current = speech;
    speak(speech);
  };

  // はじまり：あいさつ → 気分チェック
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [m, keys, streak, sessions, episode] = await Promise.all([
        loadModel(),
        recentLineKeys(),
        currentStreak(),
        db.events.where("type").equals("session").count(),
        pickEpisode(),
      ]);
      if (cancelled) return;
      model.current = m;
      recent.current = keys;
      if (sessions === 0) {
        show([line("greet_first"), line("intro_parent"), line("mood_question")]);
      } else {
        const greet = line("greet", { episode: episode?.text, streak: streak >= 2 ? String(streak) : undefined });
        if (episode && greet.display.includes(episode.text)) markEpisodeUsed(episode);
        show([greet, line("mood_question")]);
      }
      setUi("mood");
    })();
    return () => {
      cancelled = true;
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 新しい問題を出したときの声かけ */
  const announce = (s: LessonState, prefix: { display: string; speech: string }[] = []) => {
    if (s.stage === "done") return finish(s, prefix);
    if (s.stage === "choice") {
      lastPhase.current = "choice";
      return show([...prefix, line("phase_choice")]);
    }
    if (s.stage !== "answering" || !s.problem) return;
    const parts = [...prefix];
    const phase = currentPhase(s);
    if (s.isTwin) parts.push(line("twin"));
    else if (phase !== lastPhase.current) {
      parts.push(line(`phase_${phase}`, { skill: skill(s.problem.skillId).kidLabel, strong: s.plan.warmupIsStrong ? "1" : undefined }));
    }
    lastPhase.current = phase;
    const p = s.problem;
    parts.push({ display: "", speech: p.layout === "vertical" ? `ひっさんで けいさんしよう。${problemSpeech(p)}` : problemSpeech(p) });
    show(parts, "smile");
  };

  const pickMood = (mood: Mood) => {
    addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "start", mood });
    const plan = { ...planLesson({ profile, ...model.current, mood, today: ymd() }), sessionId: sessionId.current };
    const s = startLesson(plan, Date.now(), rng);
    startedAt.current = Date.now();
    setLesson(s);
    setUi("run");
    announce(s, [line(`mood_${mood}`)]);
  };

  const submit = () => {
    if (!lesson || !input) return;
    const { state, event } = answer(lesson, Number(input), Date.now());
    addEvent(event);
    setInput("");
    setLesson(state);
    if (state.stage === "correct") {
      const o = state.outcomes.at(-1)!;
      const median = model.current.states[o.problem.skillId]?.medianMs;
      const scene =
        o.maxHintLevel >= 2
          ? "correct_after_struggle"
          : o.maxHintLevel >= 1
            ? "correct_after_hint"
            : median && o.firstMs < median * 0.7
              ? "correct_fast"
              : "correct";
      show([line(scene)], scene === "correct" ? "smile" : "wow");
    } else if (state.stage === "revealed") {
      show([line("reveal", { answer: String(state.problem!.answer) })], "calm");
    } else if (state.hint) {
      show([line("wrong_nudge"), { display: "", speech: state.hint.text }], "think");
    }
  };

  const hint = () => {
    if (!lesson) return;
    const s = requestHint(lesson);
    setLesson(s);
    if (s.hint) show([{ display: "", speech: s.hint.text }], "think");
  };

  const goNext = () => {
    if (!lesson) return;
    const timeUp = Date.now() - startedAt.current > profile.maxMinutes * 60_000;
    const s = next(lesson, Date.now(), rng, timeUp);
    setLesson(s);
    if (s.stage === "think") return show([line("think_question")], "think");
    announce(s, s.timeUp && !lesson.timeUp ? [line("time_up")] : []);
  };

  const think = (card: string) => {
    if (!lesson) return;
    addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "note", thinkCard: card });
    const s = afterThink(lesson, Date.now(), rng);
    setLesson(s);
    announce(s, [line(card === "わからない" ? "think_unknown" : "think_thanks")]);
  };

  const pick = (which: "easy" | "challenge") => {
    if (!lesson) return;
    addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "note", choice: which });
    const s = choose(lesson, which, Date.now(), rng);
    setLesson(s);
    announce(s);
  };

  async function finish(s: LessonState, prefix: { display: string; speech: string }[]) {
    setUi("summary");
    const today = ymd();
    const firstToday = !(await studyDays()).includes(today);
    const minutes = Math.round((Date.now() - startedAt.current) / 60_000);
    await addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "finish", minutes });
    const streak = await currentStreak(today);
    const result = finalizeSession(model.current.states, model.current.stumbles, s.outcomes, today, firstToday ? streak : 0);
    await saveSessionResult(result);

    const count = s.outcomes.filter((o) => !o.isTwin).length;
    const growthLines = result.episodes.slice(0, 2).map((e) =>
      line(`growth_${e.kind}`, { skill: e.skillId ? skill(e.skillId).kidLabel : undefined, streak: String(streak) }),
    );
    const parts = [...prefix, line("finish", { count: String(count) }), ...growthLines, line("goodbye")];
    setSummary({ count, lines: parts.map((p) => p.display).filter(Boolean), growth: result.episodes });
    show(parts, "smile");
  }

  const choiceLabel = (id: string) => skill(id).kidLabel;
  const stage = lesson?.stage;
  const cards = lesson?.problem ? THINK_CARDS[lesson.problem.kind] : THINK_CARDS.add;
  const total = lesson?.plan.items.length ?? 0;

  return (
    <main className="kid lesson">
      <header className="lesson-top">
        <button className="corner-link" onClick={() => { stopSpeaking(); onExit(); }}>
          やめる
        </button>
        {ui === "run" && lesson && (
          <div className="progress" aria-label={`${Math.min(lesson.index + 1, total)} / ${total}`}>
            {lesson.plan.items.map((_, i) => (
              <span key={i} className={i < lesson.index ? "done" : i === lesson.index ? "now" : ""} />
            ))}
          </div>
        )}
      </header>

      <section className="teacher-row">
        <Teacher face={face} size={112} />
        <div className="bubble" aria-live="polite">
          {bubble}
          {lesson?.hint && stage === "answering" && <p className="hint">{lesson.hint.text}</p>}
          <button className="replay" onClick={() => speak(lastSpeech.current)} aria-label="もういちど きく">
            もういちど きく
          </button>
        </div>
      </section>

      {ui === "mood" && (
        <section className="cards three">
          <button className="card" onClick={() => pickMood("genki")}><b>げんき</b></button>
          <button className="card" onClick={() => pickMood("futsu")}><b>ふつう</b></button>
          <button className="card" onClick={() => pickMood("tsukare")}><b>つかれた</b></button>
        </section>
      )}

      {ui === "run" && lesson && stage === "choice" && (
        <section className="cards two">
          <button className="card" onClick={() => pick("easy")}>
            <small>とくいな</small>
            <b>{choiceLabel(lesson.plan.choiceOptions.easy)}</b>
          </button>
          <button className="card challenge" onClick={() => pick("challenge")}>
            <small>チャレンジ</small>
            <b>{choiceLabel(lesson.plan.choiceOptions.challenge)}</b>
          </button>
        </section>
      )}

      {ui === "run" && lesson && stage === "think" && (
        <section className="cards four">
          {cards.map((c) => (
            <button key={c} className="card" onClick={() => think(c)}><b>{c}</b></button>
          ))}
        </section>
      )}

      {ui === "run" && lesson?.problem && (stage === "answering" || stage === "correct" || stage === "revealed") && (
        <section className="work">
          <ProblemView
            problem={lesson.problem}
            input={stage === "correct" ? String(lesson.problem.answer) : input}
            visual={stage === "answering" ? (lesson.hint?.visual ?? null) : null}
            revealed={stage === "revealed"}
            state={stage}
          />
          <div className="controls">
            {stage === "answering" ? (
              <>
                <NumPad value={input} onChange={setInput} onSubmit={submit} />
                <button className="btn hint-btn" onClick={hint} disabled={lesson.hintLevel >= 3}>
                  ヒント
                </button>
              </>
            ) : (
              <button className="btn next" onClick={goNext}>
                {stage === "revealed" && !lesson.isTwin ? "にた もんだいへ" : "つぎへ"}
              </button>
            )}
          </div>
        </section>
      )}

      {ui === "summary" && summary && (
        <section className="summary">
          <p className="big-count">
            {summary.count}<small>もん</small>
          </p>
          {summary.growth.length > 0 && (
            <ul className="growth">
              {summary.growth.map((g) => (
                <li key={g.id}>{g.text}</li>
              ))}
            </ul>
          )}
          <button className="btn start" onClick={() => { stopSpeaking(); onExit(); }}>
            おわる
          </button>
        </section>
      )}
    </main>
  );
}
