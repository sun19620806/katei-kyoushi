import { load } from "js-yaml";
import skillsRaw from "../content/skills.yaml?raw";
import linesRaw from "../content/lines.yaml?raw";
import storiesRaw from "../content/stories.yaml?raw";
import mathHintsRaw from "../content/hints/math.yaml?raw";
import jpHintsRaw from "../content/hints/japanese.yaml?raw";
import kanjiReadRaw from "../content/japanese/kanji_read.yaml?raw";
import kanjiWriteRaw from "../content/japanese/kanji_write.yaml?raw";
import katakanaRaw from "../content/japanese/katakana.yaml?raw";
import grammarRaw from "../content/japanese/grammar.yaml?raw";
import readingRaw from "../content/japanese/reading.yaml?raw";
import type { HintDef, LineDef, MisconceptionDef, SkillDef, SkillId } from "./types";

interface SkillsFile {
  version: string;
  misconceptions: MisconceptionDef[];
  skills: SkillDef[];
}

const skillsFile = load(skillsRaw) as SkillsFile;

export const CONTENT_VERSION = skillsFile.version;
export const SKILLS: SkillDef[] = skillsFile.skills;
export const MISCONCEPTIONS: MisconceptionDef[] = skillsFile.misconceptions;
export const HINTS: HintDef[] = [
  ...(load(mathHintsRaw) as { hints: HintDef[] }).hints,
  ...(load(jpHintsRaw) as { hints: HintDef[] }).hints,
];
export const LINES: LineDef[] = (load(linesRaw) as { lines: LineDef[] }).lines;
export const STORIES: { text: string; unit: string }[] = (load(storiesRaw) as { stories: { text: string; unit: string }[] }).stories;

/** 国語の問題のもと */
export interface JpWrong {
  text: string;
  mc: string;
}
export interface JpKanjiRead { id: string; word: string; reading: string; sentence: string; wrong: JpWrong[]; hint?: string }
export interface JpKanjiWrite { id: string; reading: string; answer: string; sentence: string; wrong: JpWrong[]; hint?: string }
export interface JpKatakana { id: string; hiragana: string; clue: string; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpGrammar { id: string; sentence: string; ask: "subject" | "predicate"; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpQuestion { ask: string; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpPassage { id: string; genre: "story" | "explain"; title: string; text: string; questions: JpQuestion[] }

export const JP = {
  kanjiRead: (load(kanjiReadRaw) as { items: JpKanjiRead[] }).items,
  kanjiWrite: (load(kanjiWriteRaw) as { items: JpKanjiWrite[] }).items,
  katakana: (load(katakanaRaw) as { items: JpKatakana[] }).items,
  grammar: (load(grammarRaw) as { items: JpGrammar[] }).items,
  reading: (load(readingRaw) as { passages: JpPassage[] }).passages,
};

const skillMap = new Map(SKILLS.map((s) => [s.id, s]));

export function skill(id: SkillId): SkillDef {
  const s = skillMap.get(id);
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}

export const hasSkill = (id: SkillId) => skillMap.has(id);

export const misconceptionLabel = (id: string) => MISCONCEPTIONS.find((m) => m.id === id)?.label ?? id;

/** 親の画面で使うグループの順番 */
export const SKILL_GROUPS: string[] = [...new Set(SKILLS.map((s) => s.group))];
