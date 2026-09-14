// ドメインの型。UI や DB に依存しない。

export type SkillId = string;
export type MisconceptionId = string;

export interface SkillDef {
  id: SkillId;
  subject: "math" | "japanese";
  label: string; // 親向けの名前
  kidLabel: string; // 子ども向け（読み上げる）
  prereqs: SkillId[];
  generator: string; // domain/math/generators.ts のキー
  misconceptions: MisconceptionId[];
  group: string; // 親の画面でのまとまり
  /** 1学期までの内容。重点にはせず、ウォームアップと復習にだけ出す */
  review?: boolean;
}

export interface MisconceptionDef {
  id: MisconceptionId;
  label: string; // 親向け
}

export type ProblemKind = "add" | "sub" | "mul" | "mul_missing" | "mul_word" | "len_to_cm" | "len_to_mcm";

/** 1問の中の1つの答え（文章題は「式を選ぶ」→「答えを入れる」の2ステップ） */
export interface Step {
  type: "number" | "choice";
  answer: number; // choice のときは正しい選択肢の番号
  choices?: string[];
  prompt: string; // 子ども向けの短い指示（例：しきを えらぼう）
  unit?: string; // 答えの単位（例：cm、こ）
}

/** 画面に出す問題。答えはコードで計算済み */
export interface Problem {
  id: string;
  skillId: SkillId;
  kind: ProblemKind;
  /** 意味は kind による。add/sub/mul は a ○ b、mul_missing は a × □ = product、len は m と cm */
  a: number;
  b: number;
  answer: number; // 最後のステップの答え
  layout: "inline" | "vertical" | "missing" | "story" | "length";
  steps: Step[];
  story?: string; // 文章題の本文
  product?: number; // mul_missing の積
  cm?: number; // len_to_mcm の元の cm
}

export type HintVisual = "ones_highlight" | "tens_highlight" | "hundreds_highlight" | "carry_mark" | "borrow_mark" | "array" | "meter_tape" | "none";

export interface HintDef {
  skillId: SkillId | "*";
  misconception: MisconceptionId | "*";
  level: 1 | 2 | 3;
  step?: number; // 指定があれば、そのステップのときだけ
  kind?: ProblemKind; // 指定があれば、その種類の問題のときだけ
  text: string;
  visual?: HintVisual;
}

export interface LineDef {
  id: string;
  scene: string;
  /** 使うのに必要な変数。値がないときはこの行を選ばない */
  needs?: string[];
  variants: string[];
}

/** 学習者モデル：スキルごとの状態 */
export interface SkillState {
  skillId: SkillId;
  mastery: number; // 0..1
  attempts: number;
  correctNoHint: number;
  streakNoHint: number; // 連続ヒントなし正解
  box: number; // 復習の箱 0..5
  nextReview: string | null; // YYYY-MM-DD
  lastSeen: string | null;
  medianMs: number | null; // 直近の回答時間の中央値
  recentMs: number[];
  everNoHint: boolean;
  masteredAt: string | null;
}

export type StumbleStatus = "observed" | "confirmed" | "resolved";

export interface Stumble {
  key: string; // `${skillId}|${misconception}`
  skillId: SkillId;
  misconception: MisconceptionId;
  status: StumbleStatus;
  evidence: string[]; // 回答イベントのID
  firstSeen: string;
  lastSeen: string;
  noHintStreakSinceConfirmed: number;
}

export type Mood = "genki" | "futsu" | "tsukare";

export interface AnswerEvent {
  id: string;
  type: "answer";
  sessionId: string;
  at: string; // ISO
  problem: Problem;
  step: number; // 何ステップ目の回答か
  given: number; // choice のときは選んだ番号
  correct: boolean;
  attemptNo: number; // この問題で何回目の回答か
  hintLevel: number; // 回答時点で見ていたヒント段階（0=なし）
  misconception: MisconceptionId | null; // 間違いの推定原因
  ms: number;
  phase: LessonPhase;
  contentVersion: string;
}

export interface SessionEvent {
  id: string;
  type: "session";
  sessionId: string;
  at: string;
  kind: "start" | "finish" | "note";
  mood?: Mood;
  minutes?: number;
  choice?: string;
  thinkCard?: string;
}

export type LearnEvent = AnswerEvent | SessionEvent;

export type LessonPhase = "warmup" | "review" | "main" | "choice" | "finale";

export interface Episode {
  id: string;
  date: string; // YYYY-MM-DD
  kind: "first_no_hint" | "faster" | "streak" | "persisted" | "mastered" | "parent";
  skillId?: SkillId;
  text: string; // 親向け・子どもに話す両方で使える短文
  used?: number; // 先生が話に出した回数
}

export interface Profile {
  name: string; // 表示用
  nameYomi: string; // 読み上げ用（ひらがな）
  teacherName: string;
  favorites: string[];
  problemsPerSession: number;
  maxMinutes: number;
  allowedFrom: string; // "06:00"
  allowedTo: string; // "20:30"
  speech: boolean;
  speechRate: number;
  parentPin: string;
  /** 出さないスキル（学校でまだ習っていない単元など）。新しいスキルは自動で出る */
  disabledSkills: SkillId[];
}

/** 1問ぶんの結果（何回答えても1つにまとめる） */
export interface ProblemOutcome {
  problem: Problem;
  phase: LessonPhase;
  firstTryCorrect: boolean; // ヒントなし・1回目で正解
  maxHintLevel: number; // 使ったヒントの最大段階
  revealed: boolean; // 答えを見せた
  firstMs: number; // すべてのステップをはじめて答え終わるまでの時間
  misconceptions: string[]; // 間違えた回答それぞれの推定原因
  answerEventIds: string[];
  isTwin: boolean;
}

export interface PlannedItem {
  phase: LessonPhase;
  skillId: SkillId;
}

export interface LessonPlan {
  sessionId: string;
  focusSkill: SkillId;
  warmupIsStrong: boolean; // ウォームアップが本当に得意なスキルか（初日は false）
  items: PlannedItem[];
  choiceOptions: { easy: SkillId; challenge: SkillId };
}
