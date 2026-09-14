import Dexie, { type Table } from "dexie";
import { ymd, streakDays } from "../domain/dates";
import type { SessionResult } from "../domain/finalize";
import type { Episode, LearnEvent, Profile, SkillId, SkillState, Stumble } from "../domain/types";

/**
 * iPad の中（IndexedDB）に保存する。
 * events は書き足すだけ。skillStates / stumbles は events から計算した結果の保存。
 */
class TutorDB extends Dexie {
  events!: Table<LearnEvent, string>;
  skillStates!: Table<SkillState, string>;
  stumbles!: Table<Stumble, string>;
  episodes!: Table<Episode, string>;
  lineUsage!: Table<{ id?: number; key: string; at: string }, number>;
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("katei-kyoushi");
    this.version(1).stores({
      events: "id, sessionId, at, type",
      skillStates: "skillId",
      stumbles: "key, skillId, status",
      episodes: "id, date, kind",
      lineUsage: "++id, at",
      kv: "key",
    });
  }
}

export const db = new TutorDB();

export const DEFAULT_PROFILE: Profile = {
  name: "",
  nameYomi: "",
  teacherName: "ノート",
  favorites: [],
  problemsPerSession: 10,
  maxMinutes: 15,
  allowedFrom: "06:00",
  allowedTo: "20:30",
  speech: true,
  speechRate: 1,
  parentPin: "",
  disabledSkills: [],
};

/** v0.1 で使っていたスキル（「出す」スキルの一覧を、「出さない」一覧に変えるため） */
const V01_SKILLS = [
  "math.add.1d1d_carry", "math.add.2d2d_carry", "math.sub.2d2d_borrow",
  "math.mul.dan2", "math.mul.dan3", "math.mul.dan4", "math.mul.dan5",
  "math.mul.dan6", "math.mul.dan7", "math.mul.dan8", "math.mul.dan9",
];

export async function getProfile(): Promise<Profile | null> {
  const row = await db.kv.get("profile");
  if (!row) return null;
  const stored = row.value as Profile & { enabledSkills?: string[] };
  const { enabledSkills, ...rest } = stored;
  const disabledSkills = stored.disabledSkills ?? (enabledSkills ? V01_SKILLS.filter((id) => !enabledSkills.includes(id)) : []);
  return { ...DEFAULT_PROFILE, ...rest, disabledSkills };
}

export const saveProfile = (p: Profile) => db.kv.put({ key: "profile", value: p });

export async function loadModel() {
  const [states, stumbles] = await Promise.all([db.skillStates.toArray(), db.stumbles.toArray()]);
  return {
    states: Object.fromEntries(states.map((s) => [s.skillId, s])) as Record<SkillId, SkillState>,
    stumbles: Object.fromEntries(stumbles.map((s) => [s.key, s])) as Record<string, Stumble>,
  };
}

export async function studyDays(): Promise<string[]> {
  const starts = await db.events.where("type").equals("session").toArray();
  return [...new Set(starts.filter((e) => e.type === "session" && e.kind === "finish").map((e) => e.at.slice(0, 10)))];
}

export async function currentStreak(today = ymd()) {
  return streakDays(await studyDays(), today);
}

export async function recentLineKeys(limit = 40): Promise<string[]> {
  return (await db.lineUsage.orderBy("at").reverse().limit(limit).toArray()).map((r) => r.key);
}

export const logLine = (key: string) => db.lineUsage.add({ key, at: new Date().toISOString() });

export const addEvent = (e: LearnEvent) => db.events.put(e);

export async function saveSessionResult(r: SessionResult) {
  await db.transaction("rw", db.skillStates, db.stumbles, db.episodes, async () => {
    await db.skillStates.bulkPut(r.changedSkills.map((id) => r.states[id]));
    await db.stumbles.bulkPut(Object.values(r.stumbles));
    await db.episodes.bulkPut(r.episodes);
  });
}

/** 先生が話に出す思い出：最近のもので、あまり使っていないもの */
export async function pickEpisode(): Promise<Episode | undefined> {
  const recent = await db.episodes.orderBy("date").reverse().limit(10).toArray();
  const candidates = recent.filter((e) => (e.used ?? 0) < 2);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function markEpisodeUsed(e: Episode) {
  await db.episodes.update(e.id, { used: (e.used ?? 0) + 1 });
}

/** 先生会議用の書き出し。名前は含めない */
export async function exportData() {
  const [events, skillStates, stumbles, episodes, profile] = await Promise.all([
    db.events.toArray(),
    db.skillStates.toArray(),
    db.stumbles.toArray(),
    db.episodes.toArray(),
    getProfile(),
  ]);
  const { name: _n, nameYomi: _y, parentPin: _p, ...safeProfile } = profile ?? DEFAULT_PROFILE;
  return {
    exportedAt: new Date().toISOString(),
    format: "katei-kyoushi-export/1",
    profile: safeProfile,
    skillStates,
    stumbles,
    episodes,
    events,
  };
}

/** 端末のストレージを消されにくくする（ホーム画面に追加したPWAで有効） */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* 対応していなければ何もしない */
  }
}
