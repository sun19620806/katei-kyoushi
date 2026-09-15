import { useEffect, useRef, useState } from "react";
import {
  saveInk,
  saveProfile,
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
import { hintText } from "../../domain/hints";
import { uid } from "../../domain/random";
import type { Episode, LessonPhase, Mood, Profile, SkillState, Stumble } from "../../domain/types";
import {
  afterThink,
  answer,
  choose,
  currentPhase,
  currentStep,
  type LessonState,
  next,
  requestHint,
  startLesson,
} from "../../engine/lesson";
import { ArrowIcon, BulbIcon, CloseIcon, MoodFace, SpeakerIcon, StarIcon } from "../icons";
import { StickerIcon, STICKER_NAME } from "../stickers";
import { speak, stopSpeaking } from "../speech";
import { setUpdateSafe } from "../swUpdate";
import Teacher, { type Face } from "../Teacher";
import ChoicePad from "./ChoicePad";
import { makeTemplate, type Template } from "../../domain/handwriting/pdollar";
import HandwritePad, { type Written } from "./HandwritePad";
import NumPad from "./NumPad";
import ProblemView, { problemSpeech } from "./ProblemView";
import WeekStamps from "./WeekStamps";

type Ui = "loading" | "mood" | "run" | "summary";
type Said = { display: string; speech: string };

const PHASE_LABEL: Record<LessonPhase, string> = {
  warmup: "ウォームアップ",
  review: "ふくしゅう",
  main: "きょうの メイン",
  choice: "えらんだ もんだい",
  finale: "さいごの 1もん",
};

const THINK_CARDS: Record<string, string[]> = {
  add: ["一のくらいから たした", "10を つくった", "ゆびで かぞえた", "わからない"],
  sub: ["10を かりた", "たしざんで たしかめた", "なんとなく", "わからない"],
  mul: ["九九を となえた", "まえの こたえに たした", "おぼえていた", "わからない"],
  mul_missing: ["九九を となえて さがした", "おぼえていた", "なんとなく", "わからない"],
  mul_word: ["1つ分を さがした", "え を おもいうかべた", "なんとなく", "わからない"],
  len_to_cm: ["1m=100cmを つかった", "ものさしを おもいうかべた", "なんとなく", "わからない"],
  len_to_mcm: ["1m=100cmを つかった", "ものさしを おもいうかべた", "なんとなく", "わからない"],
  unit_to_small: ["1つ分の たんいを つかった", "ずを おもいうかべた", "なんとなく", "わからない"],
  unit_to_mixed: ["1つ分の たんいを つかった", "ずを おもいうかべた", "なんとなく", "わからない"],
  clock_read: ["みじかい はりから 見た", "5ずつ かぞえた", "なんとなく", "わからない"],
  clock_shift: ["12で わけて かんがえた", "はりを うごかす ところを そうぞうした", "なんとなく", "わからない"],
  fraction_of: ["おなじ かずずつ わけた", "九九を つかった", "なんとなく", "わからない"],
  fraction_shape: ["おなじ 大きさか 見た", "いくつに わけたか かぞえた", "なんとなく", "わからない"],
  place_compose: ["くらいの へやに わけた", "0を わすれずに かいた", "なんとなく", "わからない"],
  shape_pick: ["へんと かどを かぞえた", "線が つながって いるか 見た", "なんとなく", "わからない"],
  addsub_word: ["ことばに 目を つけた", "ずを おもいうかべた", "なんとなく", "わからない"],
  mul_rule: ["九九を ならべて くらべた", "かたまりが ふえると かんがえた", "なんとなく", "わからない"],
  compare: ["上の くらいから くらべた", "けたの かずを 見た", "なんとなく", "わからない"],
  kanji_read: ["こえに 出して 読んだ", "しって いる ことばだった", "なんとなく", "わからない"],
  kanji_write: ["文の いみを 考えた", "漢字の 形を よく 見た", "なんとなく", "わからない"],
  katakana: ["こえに 出して たしかめた", "形を よく 見た", "なんとなく", "わからない"],
  grammar: ["「〜が」を さがした", "文の おわりを 見た", "なんとなく", "わからない"],
  particle: ["ことばの うしろか 見た", "文を 読んで たしかめた", "なんとなく", "わからない"],
  vocab: ["ようすを 思いうかべた", "しって いる ことばだった", "なんとなく", "わからない"],
  reading: ["ぶんしょうに もどって さがした", "おぼえて いた", "なんとなく", "わからない"],
};

interface Summary {
  count: number;
  noHint: number;
  minutes: number;
  growth: Episode[];
  days: string[];
}

/**
 * trial にスキルを渡すと「おためし」：そのスキルを3問だけ出し、記録は残さない（おうちの人が中身を確かめる用）。
 */
export default function Lesson({
  profile,
  onExit,
  trial,
  onProfileChange,
}: {
  profile: Profile;
  onExit: () => void;
  trial?: string;
  onProfileChange?: () => void;
}) {
  const rng = Math.random;
  const [ui, setUi] = useState<Ui>("loading");
  const [bubble, setBubble] = useState("");
  const [face, setFace] = useState<Face>("smile");
  const [lesson, setLesson] = useState<LessonState | null>(null);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [inputMode, setInputMode] = useState<"tap" | "write">(profile.inputMode ?? "tap");
  const [inkTemplates, setInkTemplates] = useState<Template[]>([]);
  const written = useRef<Written | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const model = useRef<{ states: Record<string, SkillState>; stumbles: Record<string, Stumble> }>({ states: {}, stumbles: {} });
  const recent = useRef<string[]>([]);
  const lastSpeech = useRef("");
  const lastPhase = useRef("");
  const startedAt = useRef(Date.now());
  const sessionId = useRef(uid());

  const vars = { name: profile.name, teacher: profile.teacherName, favorite: profile.favorites[0] };
  const speechVars = { name: profile.nameYomi || profile.name };

  const record = trial ? () => undefined : addEvent;

  /** 場面のセリフを選ぶ（使った記録も残す） */
  const line = (scene: string, extra: Record<string, string | undefined> = {}): Said => {
    const l = pickLine(scene, { ...vars, ...extra }, recent.current, rng, speechVars);
    if (!l) return { display: "", speech: "" };
    recent.current = [l.key, ...recent.current].slice(0, 40);
    if (!trial) logLine(l.key);
    return l;
  };

  const show = (parts: Said[], f: Face = "smile") => {
    if (!mounted.current) return; // 画面を はなれた あとに しゃべらない
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
      db.ink.toArray().then((rows) => setInkTemplates(rows.map((r) => makeTemplate(String(r.digit), r.strokes))));
      if (trial) {
        const plan = { ...planLesson({ profile, ...m, mood: "futsu", today: ymd() }), sessionId: sessionId.current };
        const trialPlan = { ...plan, items: [0, 1, 2].map(() => ({ phase: "main" as const, skillId: trial })), choiceOptions: { easy: trial, challenge: trial } };
        const s = startLesson(trialPlan, Date.now(), rng);
        setLesson(s);
        setUi("run");
        announce(s, [{ display: "おためし モード（きろくは のこりません）", speech: "" }]);
        return;
      }
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
  const announce = (s: LessonState, prefix: Said[] = []) => {
    if (s.stage === "done") return finish(s, prefix);
    if (s.stage === "choice") {
      lastPhase.current = "choice";
      return show([...prefix, line("phase_choice")]);
    }
    if (s.stage !== "answering" || !s.problem) return;
    const parts = [...prefix];
    const phase = currentPhase(s);
    const phaseKey = phase === "main" || phase === "review" ? `${phase}:${s.problem.skillId}` : phase;
    if (s.isTwin) parts.push(line("twin"));
    else if (phaseKey !== lastPhase.current) {
      parts.push(line(`phase_${phase}`, { skill: skill(s.problem.skillId).kidLabel, strong: s.plan.warmupIsStrong ? "1" : undefined }));
    }
    lastPhase.current = phaseKey;
    parts.push({ display: parts.length ? "" : s.problem.steps[0].prompt, speech: problemSpeech(s.problem, 0) });
    show(parts, "smile");
  };

  const pickMood = (mood: Mood) => {
    record({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "start", mood });
    const plan = { ...planLesson({ profile, ...model.current, mood, today: ymd() }), sessionId: sessionId.current };
    const s = startLesson(plan, Date.now(), rng);
    startedAt.current = Date.now();
    setLesson(s);
    setUi("run");
    announce(s, [line(`mood_${mood}`)]);
  };

  const submit = (given?: number) => {
    if (!lesson || lesson.stage !== "answering") return;
    const handwriting = given === undefined && inputMode === "write" && currentStep(lesson)?.type === "number";
    const typed = handwriting ? (written.current?.value ?? "") : input;
    const value = given ?? (typed === "" ? NaN : Number(typed));
    if (Number.isNaN(value)) return;
    const { state, event } = answer(lesson, value, Date.now());
    record(event);
    // 正解した手書きの字は、その子のお手本に加える（つぎから読みとりやすくなる）
    if (handwriting && !trial && event.correct && written.current) {
      const samples = written.current.boxes.filter((b) => b.digit !== null && b.strokes.length > 0).map((b) => ({ digit: b.digit!, strokes: b.strokes }));
      if (samples.length) {
        saveInk(samples);
        setInkTemplates((t) => [...t, ...samples.map((x) => makeTemplate(String(x.digit), x.strokes))]);
      }
    }
    setInput("");
    setLesson(state);
    if (state.stage === "correct") {
      const o = state.outcomes.at(-1)!;
      const median = model.current.states[o.problem.skillId]?.medianMs;
      const scene =
        o.maxHintLevel >= 2
          ? "correct_after_struggle"
          : o.maxHintLevel >= 1 || !o.firstTryCorrect
            ? "correct_after_hint"
            : median && o.firstMs < median * 0.7
              ? "correct_fast"
              : "correct";
      show([line(scene)], scene === "correct" ? "smile" : "wow");
    } else if (state.stage === "revealed") {
      // 答えは「いまの ステップ」の答え。選ぶ問題は 選択肢の ことば（図なら「これ」）で 言う
      const st = currentStep(state)!;
      const text = st.type === "choice" ? st.choices![st.answer] : `${st.answer}${st.unit ?? ""}`;
      const isPicture = /^(shape|frac):/.test(text);
      const why = st.type === "choice" ? hintText(state.problem!, state.step, state.firstMisconception, 3) : null;
      show(
        [
          isPicture ? line("reveal_choice") : line("reveal", { answer: st.type === "choice" ? `「${text}」` : text }),
          ...(why ? [{ display: why.text, speech: why.text }] : []),
        ],
        "calm",
      );
    } else if (state.stepAdvanced) {
      const st = currentStep(state)!;
      const p = state.problem!;
      show([line(p.kind === "mul_word" || p.kind === "addsub_word" ? "step_ok_expr" : "step_ok"), { display: st.prompt, speech: problemSpeech(p, state.step) }], "smile");
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
    setInput("");
    if (s.stage === "think") return show([line("think_question")], "think");
    announce(s, s.timeUp && !lesson.timeUp ? [line("time_up")] : []);
  };

  const think = (card: string) => {
    if (!lesson) return;
    record({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "note", thinkCard: card });
    const s = afterThink(lesson, Date.now(), rng);
    setLesson(s);
    announce(s, [line(card === "わからない" ? "think_unknown" : "think_thanks")]);
  };

  const pick = (which: "easy" | "challenge") => {
    if (!lesson) return;
    record({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "note", choice: which });
    const s = choose(lesson, which, Date.now(), rng);
    setLesson(s);
    announce(s);
  };

  /** 学習の記録に反映する（2回 はしらないように） */
  const saveSession = async (outcomes: LessonState["outcomes"]) => {
    if (savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    setUpdateSafe(false);
    try {
      const today = ymd();
      const firstToday = !(await studyDays()).includes(today);
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000));
      await addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "finish", minutes, empty: outcomes.length === 0 });
      const streak = await currentStreak(today);
      const result = finalizeSession(model.current.states, model.current.stumbles, outcomes, today, firstToday ? streak : 0);
      await saveSessionResult(result);
      return { result, minutes, streak, days: await studyDays() };
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  async function finish(s: LessonState, prefix: Said[]) {
    setUi("summary");
    if (trial) {
      const main = s.outcomes.filter((o) => !o.isTwin);
      setSummary({ count: main.length, noHint: main.filter((o) => o.firstTryCorrect).length, minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000)), growth: [], days: [] });
      return show([{ display: "おためし おわり。", speech: "おためし おわり。" }]);
    }
    const saved = await saveSession(s.outcomes);
    if (!saved || !mounted.current) return;
    const { result, minutes, streak, days } = saved;

    const main = s.outcomes.filter((o) => !o.isTwin);
    const growthLines = result.episodes.slice(0, 2).map((e) =>
      line(`growth_${e.kind}`, { skill: e.skillId ? skill(e.skillId).kidLabel : undefined, streak: String(streak) }),
    );
    setSummary({
      count: main.length,
      noHint: main.filter((o) => o.firstTryCorrect).length,
      minutes,
      growth: result.episodes,
      days,
    });
    show([...prefix, line("finish", { count: String(main.length) }), ...growthLines, line("goodbye")], "smile");
  }

  // 外付けキーボード（と開発中の Mac）でも答えられるように
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lesson || lesson.stage !== "answering" || currentStep(lesson)?.type !== "number") return;
      if (/^\d$/.test(e.key)) setInput((v) => (v + e.key).replace(/^0+(?=\d)/, "").slice(0, 4));
      else if (e.key === "Backspace") setInput((v) => v.slice(0, -1));
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const exit = () => {
    stopSpeaking();
    onExit();
  };

  /** とちゅうでやめても、解いた問題のぶんは学習の記録に反映する */
  const quitAndSave = async () => {
    if (savingRef.current) return;
    setConfirmQuit(false);
    stopSpeaking();
    if (!trial && lesson && ui === "run") await saveSession(lesson.outcomes);
    onExit();
  };

  const stage = lesson?.stage;
  const step = lesson ? currentStep(lesson) : undefined;
  const total = lesson?.plan.items.length ?? 0;
  const working = ui === "run" && !!lesson?.problem && (stage === "answering" || stage === "correct" || stage === "revealed");
  const phase = lesson ? currentPhase(lesson) : "warmup";

  return (
    <main className="kid lesson">
      <header className="topbar">
        <button className="quit" disabled={saving} onClick={() => (ui === "run" && !trial ? setConfirmQuit(true) : exit())}>
          <CloseIcon /> やめる
        </button>
        {ui === "run" && lesson && (
          <div className="progress-wrap">
            <span className={`phase-chip ${phase}`}>
              {lesson.isTwin
                ? "もう いちど"
                : phase === "main" && lesson.problem
                  ? skill(lesson.problem.skillId).subject === "japanese"
                    ? "きょうの こくご"
                    : "きょうの さんすう"
                  : PHASE_LABEL[phase]}
            </span>
            <div className="progress" aria-hidden="true">
              {lesson.plan.items.map((it, i) => (
                <span key={i} className={`${it.phase} ${i < lesson.index ? "done" : i === lesson.index ? "now" : ""}`} />
              ))}
            </div>
            <span className="count">
              {Math.min(lesson.index + 1, total)}
              <small>/{total}</small>
            </span>
          </div>
        )}
      </header>

      {confirmQuit && (
        <div className="dialog-back" role="dialog" aria-modal="true">
          <div className="dialog">
            <Teacher look={profile.teacherLook} face="calm" size={88} />
            <p>きょうは ここで おわりに する？</p>
            <small>ここまでに といた ぶんは、ちゃんと のこるよ。</small>
            <div className="dialog-actions">
              <button onClick={quitAndSave}>おわる</button>
              <button className="keep" onClick={() => setConfirmQuit(false)} autoFocus>
                つづける
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`lesson-grid ${working ? "" : "wide"}`}>
        <section className="talk">
          <Teacher look={profile.teacherLook} face={face} size={92} />
          <div className="bubble" aria-live="polite">
            <p>{bubble}</p>
            {working && stage === "answering" && lesson?.hint && (
              <div className="hint">
                <span className="hint-chip">
                  <BulbIcon size={18} /> ヒント {lesson.hintLevel}/3
                </span>
                <p>
                  <mark>{lesson.hint.text}</mark>
                </p>
              </div>
            )}
            <button className="replay" onClick={() => speak(lastSpeech.current)} aria-label="もういちど きく">
              <SpeakerIcon />
            </button>
          </div>
        </section>

        <section className="board">
          {ui === "mood" && (
            <div className="cards three">
              {(["genki", "futsu", "tsukare"] as Mood[]).map((m) => (
                <button key={m} className="card mood" onClick={() => pickMood(m)}>
                  <MoodFace mood={m} size={84} />
                  <b>{m === "genki" ? "げんき" : m === "futsu" ? "ふつう" : "つかれた"}</b>
                </button>
              ))}
            </div>
          )}

          {ui === "run" && lesson && stage === "choice" && (
            <div className="cards two">
              <button className="card pick" onClick={() => pick("easy")}>
                <small>とくいな もんだい</small>
                <b>{skill(lesson.plan.choiceOptions.easy).kidLabel}</b>
              </button>
              <button className="card pick challenge" onClick={() => pick("challenge")}>
                <small>
                  <StarIcon size={20} /> チャレンジ
                </small>
                <b>{skill(lesson.plan.choiceOptions.challenge).kidLabel}</b>
              </button>
            </div>
          )}

          {ui === "run" && lesson && stage === "think" && (
            <div className="cards four">
              {(() => {
                const last = lesson.outcomes.at(-1)?.problem;
                return THINK_CARDS[(last?.kind === "jp_choice" ? last.layout : last?.kind) ?? "add"] ?? THINK_CARDS.add;
              })().map((c) => (
                <button key={c} className="card think" onClick={() => think(c)}>
                  <b>{c}</b>
                </button>
              ))}
            </div>
          )}

          {working && lesson?.problem && (
            <ProblemView
              problem={lesson.problem}
              step={lesson.step}
              input={input}
              visual={stage === "answering" ? (lesson.hint?.visual ?? null) : null}
              state={stage as "answering" | "correct" | "revealed"}
              noHint={!!lesson.outcomes.at(-1)?.firstTryCorrect}
            />
          )}

          {ui === "summary" && summary && (
            <div className="summary">
              <p className="summary-title">きょうの ノート</p>
              <div className="summary-stats">
                <div>
                  <b>{summary.count}</b>
                  <small>もん</small>
                </div>
                <div>
                  <b>{summary.noHint}</b>
                  <small>ヒントなし</small>
                </div>
                <div>
                  <b>{summary.minutes}</b>
                  <small>ふん</small>
                </div>
              </div>
              {summary.growth.length > 0 && (
                <div className="new-stickers">
                  <p className="new-title">あたらしい シール</p>
                  <ul>
                    {summary.growth.map((g, i) => (
                      <li key={g.id} style={{ animationDelay: `${0.2 + i * 0.25}s` }}>
                        <StickerIcon kind={g.kind} size={64} />
                        <div>
                          <b>{STICKER_NAME[g.kind]}</b>
                          <span>{g.text}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!trial && <WeekStamps days={summary.days} />}
              <button className="btn-start" onClick={exit} disabled={saving}>
                {saving ? "きろくして いるよ…" : "おわる"}
              </button>
            </div>
          )}
        </section>

        {working && lesson?.problem && (
          <section className="panel">
            {stage === "answering" && step ? (
              <>
                <div className="step-head">
                  {lesson.problem.steps.length > 1 && (
                    <ol className="step-dots">
                      {lesson.problem.steps.map((_, i) => (
                        <li key={i} className={i < lesson.step ? "done" : i === lesson.step ? "now" : ""}>
                          {i + 1}
                        </li>
                      ))}
                    </ol>
                  )}
                  <span className="step-prompt">{step.prompt}</span>
                  {step.type === "number" && (
                    <div className="mode-toggle" role="group" aria-label="すうじの いれかた">
                      {(["tap", "write"] as const).map((m) => (
                        <button
                          key={m}
                          className={inputMode === m ? "on" : ""}
                          aria-pressed={inputMode === m}
                          onClick={() => {
                            setInputMode(m);
                            setInput("");
                            if (!trial) saveProfile({ ...profile, inputMode: m }).then(() => onProfileChange?.());
                          }}
                        >
                          {m === "tap" ? "タップ" : "かく"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {step.type === "choice" ? (
                  <ChoicePad choices={step.choices ?? []} onPick={(i) => submit(i)} eliminated={lesson.eliminated} />
                ) : inputMode === "write" ? (
                  <HandwritePad
                    boxes={String(step.answer).length >= 4 || lesson.problem.layout === "vertical" || (lesson.problem.unit?.total ?? 0) >= 1000 || lesson.problem.kind === "place_compose" ? 4 : 3}
                    templates={inkTemplates}
                    resetKey={`${lesson.problem.id}-${lesson.step}-${lesson.attemptNo}`}
                    onChange={(w) => {
                      written.current = w;
                      setInput(w.value);
                    }}
                    onSubmit={() => submit()}
                  />
                ) : (
                  <NumPad value={input} onChange={setInput} onSubmit={() => submit()} />
                )}
                <button className="hint-btn" onClick={hint} disabled={lesson.hintLevel >= 3}>
                  <BulbIcon /> <span>ヒント</span>
                </button>
              </>
            ) : (
              <div className="after">
                {stage === "revealed" && step?.type === "choice" && (
                  <ChoicePad choices={step.choices ?? []} onPick={() => undefined} disabled correct={step.answer} eliminated={lesson.eliminated} />
                )}
                <p className={`after-label ${stage}`}>{stage === "correct" ? "せいかい" : "こたえを たしかめよう"}</p>
                <button className="btn-next" onClick={goNext} autoFocus>
                  {stage === "revealed" && !lesson.isTwin ? "にた もんだいへ" : "つぎへ"}
                  <ArrowIcon />
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
