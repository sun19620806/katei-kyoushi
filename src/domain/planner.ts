import { SKILLS } from "./content";
import { UNLOCK_THRESHOLD, activeStumbles, initialSkillState, isSolidForNow } from "./learner";
import { uid } from "./random";
import type { LessonPlan, Mood, PlannedItem, Profile, SkillId, SkillState, Stumble } from "./types";

interface PlanInput {
  profile: Profile;
  states: Record<SkillId, SkillState>;
  stumbles: Record<string, Stumble>;
  mood: Mood;
  today: string;
}

const isMastered = isSolidForNow;

/** 今日の授業の計画。すべてルールで決める */
export function planLesson({ profile, states, stumbles, mood, today }: PlanInput): LessonPlan {
  const enabled = SKILLS.filter((s) => profile.enabledSkills.includes(s.id));
  const st = (id: SkillId) => states[id] ?? initialSkillState(id);
  const unlocked = (id: SkillId) => {
    const def = enabled.find((s) => s.id === id);
    return !!def && def.prereqs.every((p) => !profile.enabledSkills.includes(p) || st(p).mastery >= UNLOCK_THRESHOLD);
  };

  const stumbleSkills = new Set(activeStumbles(stumbles, today).filter((s) => s.status === "confirmed").map((s) => s.skillId));
  const candidates = enabled.filter((s) => unlocked(s.id) && !isMastered(st(s.id)));

  // 重点スキル：確認済みのつまずき → 取り組み中で習熟度が低い順 → 地図の順の新しいスキル
  const focus =
    candidates.find((s) => stumbleSkills.has(s.id))?.id ??
    [...candidates].filter((s) => st(s.id).attempts > 0).sort((a, b) => st(a.id).mastery - st(b.id).mastery)[0]?.id ??
    candidates[0]?.id ??
    // 全部習得済みなら、復習がいちばん古いもの
    [...enabled].sort((a, b) => (st(a.id).nextReview ?? "").localeCompare(st(b.id).nextReview ?? ""))[0].id;

  // ウォーミングアップ：いちばん得意なスキル（無ければ重点スキル）
  const strong = [...enabled]
    .filter((s) => s.id !== focus && st(s.id).attempts > 0 && st(s.id).mastery >= UNLOCK_THRESHOLD)
    .sort((a, b) => st(b.id).mastery - st(a.id).mastery)[0]?.id;
  const warm = strong ?? focus;

  const due = enabled
    .filter((s) => s.id !== focus && s.id !== warm && st(s.id).nextReview && st(s.id).nextReview! <= today)
    .sort((a, b) => st(a.id).nextReview!.localeCompare(st(b.id).nextReview!))
    .map((s) => s.id);

  const total = mood === "tsukare" ? Math.max(5, profile.problemsPerSession - 4) : profile.problemsPerSession;
  const review = due.slice(0, mood === "tsukare" ? 1 : 3);
  const mainCount = Math.max(3, total - 2 /* warmup */ - review.length - 1 /* choice */ - 1 /* finale */);

  // チャレンジの選択肢：重点の次に進めるスキル。無ければ重点スキル
  const next = enabled.find((s) => s.id !== focus && !isMastered(st(s.id)) && s.prereqs.includes(focus))?.id;

  const items: PlannedItem[] = [
    { phase: "warmup", skillId: warm },
    { phase: "warmup", skillId: warm },
    ...review.map((skillId): PlannedItem => ({ phase: "review", skillId })),
    ...Array.from({ length: mainCount }, (): PlannedItem => ({ phase: "main", skillId: focus })),
    { phase: "choice", skillId: focus }, // 実際のスキルは子どもの選択で決まる
    { phase: "finale", skillId: warm },
  ];

  return {
    sessionId: uid(),
    warmupIsStrong: !!strong,
    focusSkill: focus,
    items,
    choiceOptions: { easy: warm, challenge: next ?? focus },
  };
}
