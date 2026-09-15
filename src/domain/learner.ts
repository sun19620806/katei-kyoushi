import { addDays, daysBetween } from "./dates";
import type { ProblemOutcome, SkillId, SkillState, Stumble } from "./types";

/** 復習の間隔（日）。箱の番号で決まる */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 14, 30];

export const MASTERY_THRESHOLD = 0.85;
export const UNLOCK_THRESHOLD = 0.6;

export function initialSkillState(skillId: SkillId): SkillState {
  return {
    skillId,
    mastery: 0,
    attempts: 0,
    correctNoHint: 0,
    streakNoHint: 0,
    box: 0,
    nextReview: null,
    lastSeen: null,
    medianMs: null,
    recentMs: [],
    everNoHint: false,
    masteredAt: null,
  };
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** 1問の結果でスキル状態を更新する */
export function updateSkill(prev: SkillState, o: ProblemOutcome, today: string): SkillState {
  const s: SkillState = { ...prev, recentMs: [...prev.recentMs], attempts: prev.attempts + 1, lastSeen: today };

  if (o.firstTryCorrect) {
    s.mastery = prev.mastery + (1 - prev.mastery) * 0.25;
    s.correctNoHint++;
    s.streakNoHint++;
    s.everNoHint = true;
    s.recentMs = [...prev.recentMs, o.firstMs].slice(-10);
    s.medianMs = median(s.recentMs);
    // 復習日が来ていた（または初めての）ときだけ箱を進める。同じ日に何度も進めない
    if (!prev.nextReview || prev.nextReview <= today) {
      s.box = prev.nextReview ? Math.min(prev.box + 1, REVIEW_INTERVALS.length - 1) : 0;
      s.nextReview = addDays(today, REVIEW_INTERVALS[s.box]);
    }
  } else if (o.revealed) {
    s.mastery = prev.mastery * 0.75;
    s.streakNoHint = 0;
    s.box = 0;
    s.nextReview = addDays(today, 1);
  } else {
    // ヒントを使って正解
    s.mastery = prev.mastery + (1 - prev.mastery) * 0.05;
    s.streakNoHint = 0;
    s.box = 0;
    s.nextReview = addDays(today, 1);
  }

  // 「身についた」は、日をまたいだ復習でも解けてから（箱2以上＝別の日に2回以上復習を通過）
  if (!s.masteredAt && s.mastery >= MASTERY_THRESHOLD && s.streakNoHint >= 4 && s.box >= 2) s.masteredAt = today;
  return s;
}

/** 今日のうちは十分できている（重点からは外し、復習で確かめる） */
export const isSolidForNow = (s: SkillState) => !!s.masteredAt || (s.mastery >= MASTERY_THRESHOLD && s.streakNoHint >= 4);

/** 親向けの記号 */
export function masterySymbol(s: SkillState | undefined): "◎" | "○" | "△" | "−" {
  if (!s || s.attempts === 0) return "−";
  if (s.masteredAt) return "◎";
  if (s.mastery >= UNLOCK_THRESHOLD) return "○";
  return "△";
}

const STUMBLE_WINDOW_DAYS = 14;

/**
 * つまずきの更新。
 * - 同じ原因の間違いが、違う問題で14日以内に2回 → 確認済み
 * - 確認済みのあと、そのスキルをヒントなしで3回続けて正解 → 解消
 */
export function updateStumbles(prev: Record<string, Stumble>, o: ProblemOutcome, today: string): Record<string, Stumble> {
  const next = { ...prev };
  const skillId = o.problem.skillId;
  const seen = new Set<string>();

  o.misconceptions.forEach((mc, i) => {
    if (mc === "unknown" || seen.has(mc)) return; // 同じ問題で同じ原因は1回と数える
    seen.add(mc);
    const key = `${skillId}|${mc}`;
    const old = next[key];
    const fresh = old && daysBetween(old.lastSeen, today) <= STUMBLE_WINDOW_DAYS && old.status !== "resolved";
    const evidence = [...(fresh ? old.evidence : []), o.wrongEventIds?.[i] ?? o.answerEventIds[i] ?? ""];
    next[key] = {
      key,
      skillId,
      misconception: mc,
      firstSeen: fresh ? old.firstSeen : today,
      lastSeen: today,
      evidence,
      status: evidence.length >= 2 ? "confirmed" : "observed",
      noHintStreakSinceConfirmed: 0,
    };
  });

  // 確認済みのつまずき：ヒントなし正解で 連続回数+1、ヒントを使った・答えを見た ときは 0に もどす
  for (const st of Object.values(next)) {
    if (st.skillId !== skillId || st.status !== "confirmed" || seen.has(st.misconception)) continue;
    const n = o.firstTryCorrect ? st.noHintStreakSinceConfirmed + 1 : 0;
    next[st.key] = { ...st, noHintStreakSinceConfirmed: n, status: n >= 3 ? "resolved" : "confirmed" };
  }
  return next;
}

/** 古くなった「観察」だけのつまずきは、表示しない */
export function activeStumbles(all: Record<string, Stumble>, today: string): Stumble[] {
  return Object.values(all).filter(
    (s) => s.status === "confirmed" || (s.status === "observed" && daysBetween(s.lastSeen, today) <= STUMBLE_WINDOW_DAYS),
  );
}
