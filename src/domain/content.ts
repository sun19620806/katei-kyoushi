import { load } from "js-yaml";
import skillsRaw from "../content/skills.yaml?raw";
import linesRaw from "../content/lines.yaml?raw";
import storiesRaw from "../content/stories.yaml?raw";
import addSubRaw from "../content/add_sub_stories.yaml?raw";
import mathHintsRaw from "../content/hints/math.yaml?raw";
import jpHintsRaw from "../content/hints/japanese.yaml?raw";
import kanjiReadRaw from "../content/japanese/kanji_read.yaml?raw";
import kanjiWriteRaw from "../content/japanese/kanji_write.yaml?raw";
import katakanaRaw from "../content/japanese/katakana.yaml?raw";
import grammarRaw from "../content/japanese/grammar.yaml?raw";
import readingRaw from "../content/japanese/reading.yaml?raw";
import vocabRaw from "../content/japanese/vocab.yaml?raw";
import particlesRaw from "../content/japanese/particles.yaml?raw";
import punctuationRaw from "../content/japanese/punctuation.yaml?raw";
import yousuRaw from "../content/japanese/yousu.yaml?raw";
import reading2Raw from "../content/japanese/reading2.yaml?raw";
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
export interface AddSubStory { id: string; kind: string; op: "add" | "sub"; key: string; text: string; unit: string }
export const ADD_SUB_STORIES: AddSubStory[] = (load(addSubRaw) as { stories: AddSubStory[] }).stories;

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
export interface JpVocab { id: string; type: "opposite" | "group"; word: string; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpParticle { id: string; sentence: string; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpPunctuation { id: string; type: "mark" | "sentence"; sentence?: string; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpYousu { id: string; sentence: string; answer: string; wrong: JpWrong[]; hint?: string }
export interface JpPassage { id: string; genre: "story" | "explain"; title: string; text: string; questions: JpQuestion[] }

export const JP = {
  kanjiRead: (load(kanjiReadRaw) as { items: JpKanjiRead[] }).items,
  kanjiWrite: (load(kanjiWriteRaw) as { items: JpKanjiWrite[] }).items,
  katakana: (load(katakanaRaw) as { items: JpKatakana[] }).items,
  grammar: (load(grammarRaw) as { items: JpGrammar[] }).items,
  reading: [...(load(readingRaw) as { passages: JpPassage[] }).passages, ...(load(reading2Raw) as { passages: JpPassage[] }).passages],
  vocab: (load(vocabRaw) as { items: JpVocab[] }).items,
  particles: (load(particlesRaw) as { items: JpParticle[] }).items,
  punctuation: (load(punctuationRaw) as { items: JpPunctuation[] }).items,
  yousu: (load(yousuRaw) as { items: JpYousu[] }).items,
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
