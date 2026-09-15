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
  const inSubjects = SKILLS.filter((s) => subjects.includes(s.subject));
  // 教科の中で ぜんぶ「出さない」に なって いたら、出さない設定を むしする（授業が 止まらないように）
  const enabled = inSubjects.some((s) => !disabled.has(s.id)) ? inSubjects.filter((s) => !disabled.has(s.id)) : inSubjects;
  const st = (id: SkillId) => states[id] ?? initialSkillState(id);
  // 前提スキルが「出さない」か「1学期のふくしゅう」なら、できているものとして扱う
  // 前提スキルが できている とみなす：1学期のふくしゅう、または 習熟度が じゅうぶん。
  // 「出さない（まだ習っていない）」に した 前提は できて いない ので、その先の 単元も 出ない。
  // ただし 教科を 出して いない ときの 前提（ほかの 教科）は むしする。
  const ready = (p: SkillId) => skill(p).review || st(p).mastery >= UNLOCK_THRESHOLD || !subjects.includes(skill(p).subject);
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

  // ウォームアップ：いちばん得意なスキル → 1学期のふくしゅう → いちばん やさしい（地図の はじめの）スキル
  const light = enabled.filter((s) => (s.weight ?? 1) === 1 && !focusSkills.includes(s.id));
  const strong = [...light]
    .filter((s) => st(s.id).attempts > 0 && st(s.id).mastery >= UNLOCK_THRESHOLD)
    .sort((a, b) => st(b.id).mastery - st(a.id).mastery)[0]?.id;
  // つぎの 候補：まだ やって いない 1学期の ふくしゅう → やった ことの ある 単元で いちばん できる もの → 前提を みたす 地図の はじめの 単元
  const firstReview = light.find((s) => s.review && st(s.id).attempts === 0)?.id;
  const unlockedLight = light.filter((s) => unlocked(s.id));
  const bestAttempted = [...unlockedLight].filter((s) => st(s.id).attempts > 0).sort((a, b) => st(b.id).mastery - st(a.id).mastery)[0]?.id;
  const warm = strong ?? firstReview ?? bestAttempted ?? unlockedLight[0]?.id ?? focus;

  const due = light
    .filter((s) => s.id !== warm && st(s.id).nextReview && st(s.id).nextReview! <= today)
    .sort((a, b) => st(a.id).nextReview!.localeCompare(st(b.id).nextReview!))
    .map((s) => s.id);

  // 問題数：設定の数を こえないように、きまった部分（ウォームアップ・えらぶ・さいご）を先に とる
  const setting = Math.max(4, profile.problemsPerSession);
  const total = mood === "tsukare" ? Math.max(4, setting - 3) : setting;
  const warmCount = total <= 6 ? 1 : 2;
  const fixed = warmCount + 2; /* choice + finale */
  const review = due.slice(0, Math.max(0, Math.min(mood === "tsukare" ? 1 : 2, total - fixed - 2)));
  const slots = Math.max(1, total - fixed - review.length);

  // 教科の配分。読みとり（重さ3）は1問で 2わく ぶんとして数える
  let mathCount = mathFocus ? slots : 0;
  let jpCount = 0;
  if (mathFocus && jpFocus && slots < 2) {
    // わくが 1つしか ないときは、その日の はじめの 教科だけに する（設定の 問題数を こえないように）
    mathCount = Number(today.slice(-2)) % 2 === 0 ? 1 : 0;
    jpCount = mathCount ? 0 : 1;
  } else if (mathFocus && jpFocus) {
    const heavy = (skill(jpFocus).weight ?? 1) >= 3;
    jpCount = heavy ? 1 : Math.max(1, Math.round(slots * 0.4));
    mathCount = Math.max(1, slots - (heavy ? 2 : jpCount));
  } else if (jpFocus) {
    const heavy = (skill(jpFocus).weight ?? 1) >= 3;
    jpCount = heavy ? Math.max(1, Math.floor(slots / 2)) : slots;
  }
  const mathItems = Array.from({ length: mathCount }, (): PlannedItem => ({ phase: "main", skillId: mathFocus! }));
  const jpItems = Array.from({ length: jpCount }, (): PlannedItem => ({ phase: "main", skillId: jpFocus! }));
  // 日によって、どちらの教科から始めるかを入れかえる
  const mathFirst = Number(today.slice(-2)) % 2 === 0;
  const mains = mathFirst ? [...mathItems, ...jpItems] : [...jpItems, ...mathItems];

  // チャレンジの選択肢：重点より後ろにある、まだ身についていないスキル（とくいな もんだいと ちがうもの）
  const base = mathFocus ?? jpFocus!;
  const list = enabled.filter((s) => s.subject === skill(base).subject);
  const baseIndex = list.findIndex((s) => s.id === base);
  const next = list.find(
    (s, i) => i > baseIndex && !s.review && (s.weight ?? 1) === 1 && s.id !== warm && !isMastered(st(s.id)) && s.prereqs.every((p) => p === base || ready(p)),
  )?.id;
  const easy = warm;
  const challenge = [next, base, jpFocus, mathFocus].find((x): x is SkillId => !!x && x !== easy) ?? base;

  const items: PlannedItem[] = [
    ...Array.from({ length: warmCount }, (): PlannedItem => ({ phase: "warmup", skillId: warm })),
    ...review.map((skillId): PlannedItem => ({ phase: "review", skillId })),
    ...mains,
    { phase: "choice", skillId: base }, // 実際のスキルは子どもの選択で決まる
    { phase: "finale", skillId: warm },
  ];

  const levels = Object.fromEntries(
    [...new Set(items.map((i) => i.skillId).concat([easy, challenge]))].map((id) => {
      return [id, levelFor(st(id))];
    }),
  ) as Record<SkillId, 0 | 1 | 2>;

  return {
    sessionId: uid(),
    focusSkill: focus,
    levels,
    focusSkills,
    warmupIsStrong: !!strong,
    items,
    choiceOptions: { easy, challenge },
  };
}

/** 問題の むずかしさ（0 やさしい・1 ふつう・2 むずかしめ）：まだ 身について いない スキルは やさしく */
export const levelFor = (s: { attempts: number; mastery: number }): 0 | 1 | 2 => (s.attempts < 4 || s.mastery < 0.35 ? 0 : s.mastery < 0.75 ? 1 : 2);
