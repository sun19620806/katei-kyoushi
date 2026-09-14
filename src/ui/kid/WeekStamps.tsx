import { addDays, ymd } from "../../domain/dates";

const LABELS = ["にち", "げつ", "か", "すい", "もく", "きん", "ど"];

/** 今週（月〜日）の、べんきょうした日に赤ペンのまる */
export default function WeekStamps({ days, today = ymd() }: { days: string[]; today?: string }) {
  const d = new Date(`${today}T12:00:00`);
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  const done = new Set(days);
  return (
    <ol className="week" aria-label="こんしゅうの べんきょう">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i);
        const label = LABELS[(i + 1) % 7];
        return (
          <li key={day} className={`${done.has(day) ? "done" : ""} ${day === today ? "today" : ""}`}>
            <span className="stamp" aria-hidden="true" />
            <small>{label}</small>
          </li>
        );
      })}
    </ol>
  );
}
