/**
 * 教材ファイルの検証。Claude Code で教材を足したら、必ず `npm run validate` を実行する。
 */
import { describe, expect, it } from "vitest";
import { ADD_SUB_STORIES, HINTS, JP, LINES, MISCONCEPTIONS, SKILLS, STORIES, skill } from "../src/domain/content";
import { hintText } from "../src/domain/hints";
import { findHint, fill, problemVars } from "../src/domain/hints";
import { simulateWrong } from "../src/domain/math/diagnose";
import { generators } from "../src/domain/math/generators";
import { seededRng } from "../src/domain/random";

/** 子どもを傷つける・急かす・比べる言い方 */
const FORBIDDEN = ["ちがう", "違う", "だめ", "ダメ", "ざんねん", "残念", "またまちが", "はやくして", "なんで", "どうして できない", "かんたんでしょ", "ばか"];
const LINE_VARS = new Set(["name", "teacher", "skill", "episode", "favorite", "answer", "streak", "count"]);
const MAX_LEN = 70;

const allText = [...HINTS.map((h) => h.text), ...LINES.flatMap((l) => l.variants)];
const STORY_MAX_LEN = 90;

describe("教材ファイル", () => {
  it("禁止表現・URL・長すぎる文がない", () => {
    for (const t of allText) {
      for (const w of FORBIDDEN) expect(t, t).not.toContain(w);
      expect(t).not.toMatch(/https?:|www\.|@/);
      expect(t.length, t).toBeLessThanOrEqual(MAX_LEN);
    }
    for (const st of ADD_SUB_STORIES) {
      for (const w of FORBIDDEN) expect(st.text, st.id).not.toContain(w);
      expect(st.text.length, st.id).toBeLessThanOrEqual(STORY_MAX_LEN);
      expect(st.text.split("{a}").length, st.id).toBe(2);
      expect(st.text.split("{b}").length, st.id).toBe(2);
      expect(st.text, st.id).toContain(st.key);
      expect(["add", "sub"]).toContain(st.op);
    }
    for (const st of STORIES) {
      for (const w of FORBIDDEN) expect(st.text).not.toContain(w);
      expect(st.text.length, st.text).toBeLessThanOrEqual(STORY_MAX_LEN);
      expect(st.text).toContain("{a}");
      expect(st.text).toContain("{b}");
    }
  });

  it("スキルの前提と原因の参照が正しい", () => {
    const ids = new Set(SKILLS.map((s) => s.id));
    const mcs = new Set(MISCONCEPTIONS.map((m) => m.id));
    for (const s of SKILLS) {
      for (const p of s.prereqs) expect(ids.has(p), `${s.id} → ${p}`).toBe(true);
      for (const m of s.misconceptions) expect(mcs.has(m), `${s.id} → ${m}`).toBe(true);
      expect(generators[s.generator], s.generator).toBeTypeOf("function");
    }
    for (const h of HINTS) {
      if (h.skillId !== "*") expect(ids.has(h.skillId), h.skillId).toBe(true);
      if (h.misconception !== "*") expect(mcs.has(h.misconception), h.misconception).toBe(true);
    }
  });

  it("すべてのスキル × ステップ × 原因 × 段階にヒントがあり、変数が埋まる", () => {
    const rng = seededRng(3);
    for (const s of SKILLS) {
      for (let i = 0; i < 30; i++) {
        const p = generators[s.generator](s.id, rng);
        p.steps.forEach((_, step) => {
          // この問題で起こりうる間違い方だけ（例：一の位がくり上がらない問題に「一の位の合計をそのまま書く」はない）
          const possible = s.misconceptions.filter((mc) => simulateWrong(p, step, mc) !== null);
          for (const mc of [...possible, "unknown"]) {
            for (const level of [1, 2, 3] as const) {
              const h = findHint(p, step, mc, level);
              expect(h, `${s.id} ${p.kind} step${step} ${mc} L${level}`).toBeDefined();
              const text = fill(h!.text, problemVars(p));
              expect(text, h!.text).not.toMatch(/\{|-\d|NaN/);
            }
          }
        });
      }
    }
  });

  it("ヒントに答えの数字をそのまま書かない", () => {
    const rng = seededRng(5);
    for (const s of SKILLS) {
      for (let i = 0; i < 50; i++) {
        const p = generators[s.generator](s.id, rng);
        p.steps.forEach((st, step) => {
          if (st.type !== "number") return;
          for (const mc of [...s.misconceptions, "unknown"]) {
            for (const level of [1, 2, 3] as const) {
              const raw = findHint(p, step, mc, level)!.text;
              const text = fill(raw, problemVars(p));
              // 文にもともと書いてある数字（「1mは 100cm」など）は除き、変数から入った数字だけを見る
              const fixed = new Set(raw.replace(/\{\w+\}/g, " ").match(/\d+/g) ?? []);
              const numbers = (text.match(/\d+/g) ?? []).filter((n) => !fixed.has(n));
              expect(numbers, `${text}（答え ${st.answer}）`).not.toContain(String(st.answer));
            }
          }
        });
      }
    }
  });

  it("セリフの変数は決まったものだけ、IDは重ならない", () => {
    const ids = new Set<string>();
    for (const l of LINES) {
      expect(ids.has(l.id), l.id).toBe(false);
      ids.add(l.id);
      for (const v of l.variants) {
        for (const [, k] of v.matchAll(/\{(\w+)\}/g)) expect(LINE_VARS.has(k), `${l.id}: {${k}}`).toBe(true);
      }
    }
  });

  it("授業で使う場面のセリフがそろっている", () => {
    const scenes = new Set(LINES.map((l) => l.scene));
    const required = [
      "greet_first", "greet", "mood_question", "mood_genki", "mood_futsu", "mood_tsukare",
      "phase_warmup", "phase_review", "phase_main", "phase_choice", "phase_finale",
      "correct", "step_ok", "correct_fast", "correct_after_hint", "correct_after_struggle", "wrong_nudge",
      "reveal", "twin", "think_question", "think_thanks", "think_unknown", "time_up", "finish", "goodbye",
      "growth_first_no_hint", "growth_faster", "growth_mastered", "growth_persisted", "growth_streak",
    ];
    for (const r of required) expect(scenes.has(r), r).toBe(true);
  });

  it("国語：正解・まちがい・原因・ヒントがそろっている", () => {
    const check = (skillId: string, id: string, answer: string, wrong: { text: string; mc: string }[], hint: string | undefined, extra: string[]) => {
      const mcs = new Set(skill(skillId).misconceptions);
      const texts = wrong.map((w) => w.text);
      expect(texts, id).not.toContain(answer);
      expect(new Set(texts).size, id).toBe(texts.length);
      expect(wrong.length, id).toBeGreaterThanOrEqual(2);
      for (const w of wrong) expect(mcs.has(w.mc), `${id}: ${w.mc}`).toBe(true);
      if (hint) {
        expect(hint, id).not.toContain(answer);
        expect(hint.length, id).toBeLessThanOrEqual(MAX_LEN);
      }
      for (const t of [answer, ...texts, hint ?? "", ...extra]) for (const f of FORBIDDEN) expect(t, `${id}: ${f}`).not.toContain(f);
    };
    for (const it of JP.kanjiRead) {
      expect(it.sentence.split("{word}").length, it.id).toBe(2);
      check("jp.kanji.read", it.id, it.reading, it.wrong, it.hint, [it.sentence]);
    }
    for (const it of JP.kanjiWrite) {
      expect(it.sentence.split("{blank}").length, it.id).toBe(2);
      check("jp.kanji.write", it.id, it.answer, it.wrong, it.hint, [it.sentence]);
    }
    for (const it of JP.katakana) check("jp.katakana", it.id, it.answer, it.wrong, it.hint, [it.clue]);
    for (const it of JP.grammar) {
      check("jp.grammar.subject", it.id, it.answer, it.wrong, it.hint, [it.sentence]);
      for (const t of [it.answer, ...it.wrong.map((w) => w.text)]) expect(it.sentence, `${it.id}: ${t}`).toContain(t);
    }
    for (const it of JP.particles) {
      expect(it.sentence.split("{blank}").length, it.id).toBe(2);
      check("jp.particles", it.id, it.answer, it.wrong, undefined, [it.sentence, it.hint ?? ""]);
      if (it.hint) expect(it.hint, it.id).not.toContain(`「${it.answer}」`);
    }
    for (const it of JP.vocab) check(it.type === "opposite" ? "jp.vocab.opposite" : "jp.vocab.group", it.id, it.answer, it.wrong, it.hint, [it.word]);
    for (const ps of JP.reading) {
      expect(ps.text.length, ps.id).toBeLessThanOrEqual(320);
      for (const f of FORBIDDEN) expect(ps.text, `${ps.id}: ${f}`).not.toContain(f);
      ps.questions.forEach((q, i) => check(`jp.reading.${ps.genre}`, `${ps.id}-q${i + 1}`, q.answer, q.wrong, q.hint, [q.ask]));
    }
  });

  it("国語：どのヒントにも、正しい選択肢の ことばを そのまま 書かない", () => {
    const rng = seededRng(11);
    for (const s of SKILLS.filter((x) => x.subject === "japanese")) {
      for (let i = 0; i < 40; i++) {
        const p = generators[s.generator](s.id, rng);
        p.steps.forEach((st, step) => {
          const correct = st.choices![st.answer];
          for (const mc of [...s.misconceptions, "unknown"]) {
            for (const level of [1, 2, 3] as const) {
              const h = hintText(p, step, mc, level);
              expect(h, `${s.id} ${mc} L${level}`).not.toBeNull();
              // 1文字の答え（は・を など）は、ふつうの ことばにも 入るので「」つきで 書いて いないかを 見る
              const needle = correct.length === 1 ? `「${correct}」` : correct;
              expect(h!.text, `${s.id} ${p.jp?.itemId} step${step}`).not.toContain(needle);
            }
          }
        });
      }
    }
  });
});
