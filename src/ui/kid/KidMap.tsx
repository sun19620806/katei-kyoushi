import { useEffect, useState } from "react";
import { loadModel } from "../../db/db";
import { SKILL_GROUPS, SKILLS } from "../../domain/content";
import { MASTERY_THRESHOLD, UNLOCK_THRESHOLD } from "../../domain/learner";
import type { Profile, SkillState } from "../../domain/types";
import { ArrowIcon } from "../icons";

type Level = "none" | "practice" | "can" | "master";

const LEVEL_TEXT: Record<Level, string> = { none: "まだ", practice: "れんしゅう中", can: "できた", master: "とくいわざ" };

function levelOf(s: SkillState | undefined): Level {
  if (!s || s.attempts === 0) return "none";
  if (s.masteredAt) return "master";
  if (s.mastery >= MASTERY_THRESHOLD || s.mastery >= UNLOCK_THRESHOLD) return "can";
  return "practice";
}

/** がくしゅうマップ：子ども向けに「できた」が ふえていく ようすを 見せる */
export default function KidMap({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const [states, setStates] = useState<Record<string, SkillState> | null>(null);

  useEffect(() => {
    loadModel().then((m) => setStates(m.states));
  }, []);

  const visible = SKILLS.filter((s) => !profile.disabledSkills.includes(s.id) && profile.subjects.includes(s.subject));
  const counts = visible.reduce(
    (acc, s) => {
      const l = levelOf(states?.[s.id]);
      if (l === "can" || l === "master") acc.done++;
      return acc;
    },
    { done: 0 },
  );

  return (
    <main className="kid subpage">
      <header className="sub-head">
        <button className="back" onClick={onBack}>
          <span className="flip">
            <ArrowIcon size={22} />
          </span>
          もどる
        </button>
        <h1>がくしゅうマップ</h1>
        <span className="count-badge">
          {counts.done} / {visible.length}
        </span>
      </header>

      <div className="map-legend">
        {(["none", "practice", "can", "master"] as Level[]).map((l) => (
          <span key={l}>
            <i className={`badge ${l}`} aria-hidden="true" />
            {LEVEL_TEXT[l]}
          </span>
        ))}
      </div>

      <div className="map-groups">
        {SKILL_GROUPS.map((g) => {
          const skills = visible.filter((s) => s.group === g);
          if (skills.length === 0) return null;
          return (
            <section key={g} className={`map-group ${skills[0].subject}`}>
              <h2>
                <em>{skills[0].subject === "japanese" ? "こくご" : "さんすう"}</em>
                {g}
              </h2>
              <ul>
                {skills.map((s) => {
                  const l = levelOf(states?.[s.id]);
                  return (
                    <li key={s.id} className={l}>
                      <i className={`badge ${l}`} aria-hidden="true" />
                      <span>{s.kidLabel}</span>
                      <small>{LEVEL_TEXT[l]}</small>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
