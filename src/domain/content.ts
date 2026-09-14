import { load } from "js-yaml";
import skillsRaw from "../content/skills.yaml?raw";
import linesRaw from "../content/lines.yaml?raw";
import mathHintsRaw from "../content/hints/math.yaml?raw";
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
export const HINTS: HintDef[] = (load(mathHintsRaw) as { hints: HintDef[] }).hints;
export const LINES: LineDef[] = (load(linesRaw) as { lines: LineDef[] }).lines;

const skillMap = new Map(SKILLS.map((s) => [s.id, s]));

export function skill(id: SkillId): SkillDef {
  const s = skillMap.get(id);
  if (!s) throw new Error(`unknown skill: ${id}`);
  return s;
}

export const misconceptionLabel = (id: string) => MISCONCEPTIONS.find((m) => m.id === id)?.label ?? id;
