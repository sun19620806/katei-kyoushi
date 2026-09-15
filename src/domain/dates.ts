/** ローカル時刻の YYYY-MM-DD */
export function ymd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 保存した時刻（ISO・UTC）を、その端末の日付 YYYY-MM-DD にする（日本の朝9時前が前の日にならないように） */
export const localDay = (iso: string) => ymd(new Date(iso));

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + n));
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** 学習した日の一覧から、today を含む（または昨日までの）連続日数 */
export function streakDays(studyDays: string[], today: string): number {
  const set = new Set(studyDays);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
