import { SKILLS, skill } from "./content";
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
  const disabled = new Set(profile.disabledSkills);
  const subjects = profile.subjects?.length ? profile.subjects : ["math", "japanese"];
  const enabled = SKILLS.filter((s) => !disabled.has(s.id) && subjects.includes(s.subject));
  const st = (id: SkillId) => states[id] ?? initialSkillState(id);
  // 前提スキルが「出さない」か「1学期のふくしゅう」なら、できているものとして扱う
  const ready = (p: SkillId) => disabled.has(p) || skill(p).review || st(p).mastery >= UNLOCK_THRESHOLD;
  const unlocked = (id: SkillId) => enabled.some((s) => s.id === id) && skill(id).prereqs.every(ready);
  const stumbleSkills = new Set(activeStumbles(stumbles, today).filter((s) => s.status === "confirmed").map((s) => s.skillId));

  /** 教科の中の重点スキル：確認済みのつまずき → 取り組み中で習熟度が低い順 → 地図の順の新しいスキル */
  const focusOf = (list: typeof enabled): SkillId | null => {
    if (list.length === 0) return null;
    const candidates = list.filter((s) => unlocked(s.id) && !isMastered(st(s.id)) && (!s.review || stumbleSkills.has(s.id)));
    return (
      candidates.find((s) => stumbleSkills.has(s.id))?.id ??
      [...candidates].filter((s) => st(s.id).attempts > 0).sort((a, b) => st(a.id).mastery - st(b.id).mastery)[0]?.id ??
      candidates[0]?.id ??
      [...list].sort((a, b) => (st(a.id).nextReview ?? "").localeCompare(st(b.id).nextReview ?? ""))[0].id
    );
  };
  const mathFocus = focusOf(enabled.filter((s) => s.subject === "math"));
  const jpFocus = focusOf(enabled.filter((s) => s.subject === "japanese"));
  const focusSkills = [mathFocus, jpFocus].filter((x): x is SkillId => !!x);
  const focus = focusSkills[0] ?? SKILLS[0].id;

  // ウォームアップ：いちばん得意なスキル。記録がなければ、まだやっていない1学期のふくしゅう
  const strong = [...enabled]
    .filter((s) => !focusSkills.includes(s.id) && st(s.id).attempts > 0 && st(s.id).mastery >= UNLOCK_THRESHOLD && (s.weight ?? 1) === 1)
    .sort((a, b) => st(b.id).mastery - st(a.id).mastery)[0]?.id;
  const firstReview = enabled.find((s) => s.review && !focusSkills.includes(s.id) && st(s.id).attempts === 0)?.id;
  const warm = strong ?? firstReview ?? focus;

  const due = enabled
    .filter((s) => !focusSkills.includes(s.id) && s.id !== warm && (s.weight ?? 1) === 1 && st(s.id).nextReview && st(s.id).nextReview! <= today)
    .sort((a, b) => st(a.id).nextReview!.localeCompare(st(b.id).nextReview!))
    .map((s) => s.id);

  const total = mood === "tsukare" ? Math.max(5, profile.problemsPerSession - 4) : profile.problemsPerSession;
  const review = due.slice(0, mood === "tsukare" ? 1 : 2);
  const slots = Math.max(3, total - 2 /* warmup */ - review.length - 1 /* choice */ - 1 /* finale */);

  // 教科の配分。読みとり（重さ3）は1問で3問ぶん
  let mathCount = mathFocus ? slots : 0;
  let jpCount = 0;
  if (mathFocus && jpFocus) {
    const heavy = (skill(jpFocus).weight ?? 1) >= 3;
    jpCount = heavy ? 1 : Math.max(2, Math.round(slots * 0.4));
    mathCount = Math.max(2, slots - (heavy ? 3 : jpCount));
  } else if (jpFocus) {
    const heavy = (skill(jpFocus).weight ?? 1) >= 3;
    jpCount = heavy ? Math.max(1, Math.floor(slots / 3)) : slots;
  }
  const mathItems = Array.from({ length: mathCount }, (): PlannedItem => ({ phase: "main", skillId: mathFocus! }));
  const jpItems = Array.from({ length: jpCount }, (): PlannedItem => ({ phase: "main", skillId: jpFocus! }));
  // 日によって、どちらの教科から始めるかを入れかえる
  const mathFirst = Number(today.slice(-2)) % 2 === 0;
  const mains = mathFirst ? [...mathItems, ...jpItems] : [...jpItems, ...mathItems];

  // チャレンジの選択肢：算数の重点より後ろにある、まだ身についていないスキル
  const base = mathFocus ?? jpFocus!;
  const list = enabled.filter((s) => s.subject === skill(base).subject);
  const baseIndex = list.findIndex((s) => s.id === base);
  const next = list.find(
    (s, i) => i > baseIndex && !s.review && (s.weight ?? 1) === 1 && !isMastered(st(s.id)) && s.prereqs.every((p) => p === base || ready(p)),
  )?.id;
  const easy = warm;

  const items: PlannedItem[] = [
    { phase: "warmup", skillId: warm },
    { phase: "warmup", skillId: warm },
    ...review.map((skillId): PlannedItem => ({ phase: "review", skillId })),
    ...mains,
    { phase: "choice", skillId: base }, // 実際のスキルは子どもの選択で決まる
    { phase: "finale", skillId: warm },
  ];

  return {
    sessionId: uid(),
    focusSkill: focus,
    focusSkills,
    warmupIsStrong: !!strong,
    items,
    choiceOptions: { easy, challenge: next ?? base },
  };
}
