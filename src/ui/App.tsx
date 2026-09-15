import { Component, type ReactNode, useCallback, useEffect, useState } from "react";
import { getProfile, recoverUnfinishedSessions, requestPersistence } from "../db/db";
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
import { setUpdateSafe } from "./swUpdate";

type Screen = "home" | "lesson" | "pin" | "parent" | "trial" | "stickers" | "map" | "teacher";

/** 思わぬ エラーで 画面が まっ白に ならないように */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="kid crash">
        <p className="crash-title">ごめんね、うまく うごかなかったよ。</p>
        <p className="crash-sub">もういちど ひらくと つづけられるよ。</p>
        <button className="btn-start" onClick={() => location.reload()}>
          もういちど ひらく
        </button>
        <small className="crash-detail">{this.state.error.message}</small>
      </main>
    );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Main />
    </ErrorBoundary>
  );
}

function Main() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [trialSkill, setTrialSkill] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const p = await getProfile();
      if (p) configureSpeech({ enabled: p.speech, rate: p.speechRate });
      setProfile(p);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // 授業・おうちの人の設定・はじめの設定の とちゅうでは、アプリの 更新で 読みこみ直さない
  useEffect(() => {
    setUpdateSafe(profile !== null && ["home", "stickers", "map", "teacher", "pin"].includes(screen));
  }, [screen, profile]);

  useEffect(() => {
    // とちゅうで とじられた 授業を しめくくってから、画面を 出す
    recoverUnfinishedSessions()
      .catch(() => undefined)
      .finally(reload);
    requestPersistence();
  }, [reload]);

  if (loadError)
    return (
      <main className="kid crash">
        <p className="crash-title">きろくを よみこめなかったよ。</p>
        <p className="crash-sub">iPad の のこりの 容量や、Safari の プライベートブラウズを たしかめてから、もういちど ひらいてね。</p>
        <button className="btn-start" onClick={() => location.reload()}>
          もういちど ひらく
        </button>
        <small className="crash-detail">{loadError}</small>
      </main>
    );
  if (profile === undefined) return null;
  if (profile === null) return <Setup onDone={reload} />;

  // 開発中だけ：?trial=スキルID でその単元のおためし画面を直接開く（見た目の確認用）
  const devTrial = import.meta.env.DEV ? new URLSearchParams(location.search).get("trial") : null;
  if (devTrial) return <Lesson key={devTrial} profile={profile} trial={devTrial} onExit={() => (location.search = "")} />;

  switch (screen) {
    case "lesson":
      return <Lesson profile={profile} onExit={() => setScreen("home")} onProfileChange={reload} />;
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
