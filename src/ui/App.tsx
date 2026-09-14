import { useCallback, useEffect, useState } from "react";
import { getProfile, requestPersistence } from "../db/db";
import type { Profile } from "../domain/types";
import Home from "./kid/Home";
import Lesson from "./kid/Lesson";
import Parent from "./parent/Parent";
import PinGate from "./parent/PinGate";
import Setup from "./parent/Setup";
import { configureSpeech } from "./speech";

type Screen = "home" | "lesson" | "pin" | "parent";

export default function App() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>("home");

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

  switch (screen) {
    case "lesson":
      return <Lesson profile={profile} onExit={() => setScreen("home")} />;
    case "pin":
      return <PinGate pin={profile.parentPin} onOk={() => setScreen("parent")} onCancel={() => setScreen("home")} />;
    case "parent":
      return (
        <Parent
          profile={profile}
          onProfileChange={reload}
          onExit={() => setScreen("home")}
        />
      );
    default:
      return <Home profile={profile} onStart={() => setScreen("lesson")} onParent={() => setScreen("pin")} />;
  }
}
