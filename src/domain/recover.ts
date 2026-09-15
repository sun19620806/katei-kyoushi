import type { AnswerEvent, ProblemOutcome } from "./types";

/**
 * 回答の記録から、問題ごとの結果を組み立てなおす。
 * アプリが とちゅうで とじられた（iPad が 裏で 止めた など）授業の ぶんを、あとから 学習の記録に 反映する ために 使う。
 * 最後まで 答えていない 問題は 入れない。
 */
export function rebuildOutcomes(answers: AnswerEvent[]): ProblemOutcome[] {
  const groups = new Map<string, AnswerEvent[]>();
  for (const e of [...answers].sort((a, b) => a.at.localeCompare(b.at))) {
    const list = groups.get(e.problem.id) ?? [];
    list.push(e);
    groups.set(e.problem.id, list);
  }

  const outcomes: ProblemOutcome[] = [];
  for (const events of groups.values()) {
    const p = events[0].problem;
    const lastStep = (p.steps?.length ?? 1) - 1;
    const lastStepEvents = events.filter((e) => (e.step ?? 0) === lastStep);
    const solved = lastStepEvents.some((e) => e.correct);
    const revealed = !solved && events.some((e) => !e.correct && e.hintLevel >= 3);
    if (!solved && !revealed) continue;
    const wrong = events.filter((e) => !e.correct);
    const maxHintLevel = Math.max(0, ...events.map((e) => e.hintLevel));
    outcomes.push({
      problem: p,
      phase: events[0].phase,
      firstTryCorrect: wrong.length === 0 && maxHintLevel === 0,
      maxHintLevel,
      revealed,
      firstMs: (lastStepEvents[0] ?? events[0]).ms,
      misconceptions: wrong.map((e) => e.misconception ?? "unknown"),
      answerEventIds: events.map((e) => e.id),
      wrongEventIds: wrong.map((e) => e.id),
      isTwin: false,
    });
  }
  return outcomes;
}
