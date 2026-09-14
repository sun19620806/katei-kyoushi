import { skill } from "./content";
import { initialSkillState, updateSkill, updateStumbles } from "./learner";
import { uid } from "./random";
import type { Episode, ProblemOutcome, SkillId, SkillState, Stumble } from "./types";

export interface SessionResult {
  states: Record<SkillId, SkillState>;
  stumbles: Record<string, Stumble>;
  episodes: Episode[]; // 今回新しくできた思い出（成長）
  changedSkills: SkillId[];
}

const STREAK_MILESTONES = [3, 5, 7, 10, 14, 21, 30, 50, 100];

/** 授業の結果から、学習者モデルを更新し、成長を見つける（すべてルール） */
export function finalizeSession(
  prevStates: Record<SkillId, SkillState>,
  prevStumbles: Record<string, Stumble>,
  outcomes: ProblemOutcome[],
  today: string,
  streak: number,
): SessionResult {
  const states = { ...prevStates };
  let stumbles = { ...prevStumbles };
  for (const o of outcomes) {
    const id = o.problem.skillId;
    states[id] = updateSkill(states[id] ?? initialSkillState(id), o, today);
    stumbles = updateStumbles(stumbles, o, today);
  }

  const changedSkills = [...new Set(outcomes.map((o) => o.problem.skillId))];
  const episodes: Episode[] = [];
  const ep = (kind: Episode["kind"], text: string, skillId?: SkillId) =>
    episodes.push({ id: uid(), date: today, kind, text, skillId });

  for (const id of changedSkills) {
    const before = prevStates[id] ?? initialSkillState(id);
    const after = states[id];
    const label = skill(id).kidLabel;
    if (!before.masteredAt && after.masteredAt) {
      ep("mastered", `${label}が とくいわざに なった`, id);
      continue;
    }
    if (!before.everNoHint && after.everNoHint) ep("first_no_hint", `${label}を はじめて ヒントなしで とけた`, id);

    const fastMs = outcomes.filter((o) => o.problem.skillId === id && o.firstTryCorrect).map((o) => o.firstMs);
    if (before.medianMs && fastMs.length >= 3) {
      const sorted = [...fastMs].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      if (med <= before.medianMs * 0.75) ep("faster", `${label}が まえより はやく とけるように なった`, id);
    }
  }

  const persisted = outcomes.find((o) => !o.firstTryCorrect && !o.revealed && o.maxHintLevel >= 2);
  if (persisted) ep("persisted", `むずかしい ${skill(persisted.problem.skillId).kidLabel}を さいごまで かんがえた`, persisted.problem.skillId);

  if (STREAK_MILESTONES.includes(streak)) ep("streak", `${streak}にち れんぞくで べんきょう した`);

  return { states, stumbles, episodes, changedSkills };
}
