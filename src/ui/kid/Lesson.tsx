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
import { speak, stopSpeaking } from "../speech";
import Teacher, { type Face } from "../Teacher";
import ChoicePad from "./ChoicePad";
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
  kanji_read: ["こえに 出して 読んだ", "しって いる ことばだった", "なんとなく", "わからない"],
  kanji_write: ["文の いみを 考えた", "漢字の 形を よく 見た", "なんとなく", "わからない"],
  katakana: ["こえに 出して たしかめた", "形を よく 見た", "なんとなく", "わからない"],
  grammar: ["「〜が」を さがした", "文の おわりを 見た", "なんとなく", "わからない"],
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
export default function Lesson({ profile, onExit, trial }: { profile: Profile; onExit: () => void; trial?: string }) {
  const rng = Math.random;
  const [ui, setUi] = useState<Ui>("loading");
  const [bubble, setBubble] = useState("");
  const [face, setFace] = useState<Face>("smile");
  const [lesson, setLesson] = useState<LessonState | null>(null);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

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
    const phaseKey = phase === "main" ? `main:${s.problem.skillId}` : phase;
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
    const value = given ?? (input === "" ? NaN : Number(input));
    if (Number.isNaN(value)) return;
    const { state, event } = answer(lesson, value, Date.now());
    record(event);
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
      show([line("reveal", { answer: String(state.problem!.answer) })], "calm");
    } else if (state.stepAdvanced) {
      const st = currentStep(state)!;
      const p = state.problem!;
      show([line(p.kind === "mul_word" ? "step_ok_expr" : "step_ok"), { display: st.prompt, speech: problemSpeech(p, state.step) }], "smile");
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

  async function finish(s: LessonState, prefix: Said[]) {
    setUi("summary");
    if (trial) {
      const main = s.outcomes.filter((o) => !o.isTwin);
      setSummary({ count: main.length, noHint: main.filter((o) => o.firstTryCorrect).length, minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000)), growth: [], days: [] });
      return show([{ display: "おためし おわり。", speech: "おためし おわり。" }]);
    }
    const today = ymd();
    const firstToday = !(await studyDays()).includes(today);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000));
    await addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "finish", minutes });
    const streak = await currentStreak(today);
    const result = finalizeSession(model.current.states, model.current.stumbles, s.outcomes, today, firstToday ? streak : 0);
    await saveSessionResult(result);

    const main = s.outcomes.filter((o) => !o.isTwin);
    const growthLines = result.episodes.slice(0, 2).map((e) =>
      line(`growth_${e.kind}`, { skill: e.skillId ? skill(e.skillId).kidLabel : undefined, streak: String(streak) }),
    );
    setSummary({
      count: main.length,
      noHint: main.filter((o) => o.firstTryCorrect).length,
      minutes,
      growth: result.episodes,
      days: await studyDays(),
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
    stopSpeaking();
    if (!trial && lesson && lesson.outcomes.length > 0 && ui === "run") {
      const today = ymd();
      const firstToday = !(await studyDays()).includes(today);
      const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000));
      await addEvent({ id: uid(), type: "session", sessionId: sessionId.current, at: new Date().toISOString(), kind: "finish", minutes });
      const streak = await currentStreak(today);
      await saveSessionResult(finalizeSession(model.current.states, model.current.stumbles, lesson.outcomes, today, firstToday ? streak : 0));
    }
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
        <button className="quit" onClick={() => (ui === "run" && !trial ? setConfirmQuit(true) : exit())}>
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
            <Teacher face="calm" size={88} />
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
          <Teacher face={face} size={92} />
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
                <ul className="growth">
                  {summary.growth.map((g) => (
                    <li key={g.id}>{g.text}</li>
                  ))}
                </ul>
              )}
              {!trial && <WeekStamps days={summary.days} />}
              <button className="btn-start" onClick={exit}>
                おわる
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
                </div>
                {step.type === "choice" ? (
                  <ChoicePad choices={step.choices ?? []} onPick={(i) => submit(i)} />
                ) : (
                  <NumPad value={input} onChange={setInput} onSubmit={() => submit()} />
                )}
                <button className="hint-btn" onClick={hint} disabled={lesson.hintLevel >= 3}>
                  <BulbIcon /> <span>ヒント</span>
                </button>
              </>
            ) : (
              <div className="after">
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
