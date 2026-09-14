import { useCallback, useEffect, useState } from "react";
import { getProfile, requestPersistence } from "../db/db";
import type { Profile } from "../domain/types";
import Home from "./kid/Home";
import KidMap from "./kid/KidMap";
import StickerBook from "./kid/StickerBook";
import TeacherPicker from "./kid/TeacherPicker";
import Lesson from "./kid/Lesson";
import Parent from "./parent/Parent";
import PinGate from "./parent/PinGate";
import Setup from "./parent/Setup";
import { configureSpeech } from "./speech";

type Screen = "home" | "lesson" | "pin" | "parent" | "trial" | "stickers" | "map" | "teacher";

export default function App() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>("home");
  const [trialSkill, setTrialSkill] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const p = await getProfile();
    if (p) configureSpeech({ enabled: p.speech, rate: p.speechRate });
    setProfile(p);
  }, []);

  useEffect(() => {
    reload();
    requestPersistence();
  }, [reload]);

  if (profile === undefined) return null;
  if (profile === null) return <Setup onDone={reload} />;

  // 開発中だけ：?trial=スキルID でその単元のおためし画面を直接開く（見た目の確認用）
  const devTrial = import.meta.env.DEV ? new URLSearchParams(location.search).get("trial") : null;
  if (devTrial) return <Lesson key={devTrial} profile={profile} trial={devTrial} onExit={() => (location.search = "")} />;

  switch (screen) {
    case "lesson":
      return <Lesson profile={profile} onExit={() => setScreen("home")} />;
    case "trial":
      return <Lesson key={trialSkill} profile={profile} trial={trialSkill ?? undefined} onExit={() => setScreen("parent")} />;
    case "pin":
      return <PinGate pin={profile.parentPin} onOk={() => setScreen("parent")} onCancel={() => setScreen("home")} />;
    case "parent":
      return (
        <Parent
          profile={profile}
          onProfileChange={reload}
          onExit={() => setScreen("home")}
          onTrial={(id) => {
            setTrialSkill(id);
            setScreen("trial");
          }}
        />
      );
    case "stickers":
      return <StickerBook profile={profile} onBack={() => setScreen("home")} />;
    case "map":
      return <KidMap profile={profile} onBack={() => setScreen("home")} />;
    case "teacher":
      return (
        <TeacherPicker
          profile={profile}
          onDone={() => {
            reload();
            setScreen("home");
          }}
        />
      );
    default:
      return (
        <Home
          profile={profile}
          onStart={() => setScreen("lesson")}
          onParent={() => setScreen("pin")}
          onStickers={() => setScreen("stickers")}
          onMap={() => setScreen("map")}
          onTeacher={() => setScreen("teacher")}
        />
      );
  }
}
