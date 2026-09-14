import { describe, expect, it } from "vitest";
import { HINTS, LINES, STORIES } from "../src/domain/content";
import { toSpeakable } from "../src/domain/speechText";

describe("読み上げ用の文", () => {
  it("助詞の「は」「を」「へ」を、読む音に直す", () => {
    expect(toSpeakable("こたえは なんcm？")).toBe("こたえわなんセンチ？");
    expect(toSpeakable("すうじを 1つだけ かくよ。")).toBe("すうじお 1つだけかくよ。");
    expect(toSpeakable("十のくらいへ おひっこし。")).toBe("じゅうのくらいえおひっこし。");
    expect(toSpeakable("9 + 8 は？")).toBe("9 たす 8 わ？");
  });

  it("ことばの中の「は」「へ」は そのまま", () => {
    expect(toSpeakable("はじめまして")).toBe("はじめまして");
    expect(toSpeakable("1 へるよ")).toBe("1 へるよ");
    expect(toSpeakable("ヒントを はってみよう")).toBe("ヒントおはってみよう");
  });

  it("漢字・記号・単位を読みに直す", () => {
    expect(toSpeakable("九九を となえて")).toBe("くくおとなえて");
    expect(toSpeakable("1m20cmは")).toBe("1メートル20センチわ");
    expect(toSpeakable("□には、mに した のこりの cmだけを かくよ。")).toBe("しかくにわ、メートルにしたのこりのセンチだけおかくよ。");
    expect(toSpeakable("7× □ = 42")).toBe("7 かけるしかくわ 42");
  });

  it("教材のどの文にも、助詞の「は」「を」が残らない", () => {
    const all = [...HINTS.map((h) => h.text), ...LINES.flatMap((l) => l.variants), ...STORIES.map((s) => s.text)];
    for (const t of all) {
      const spoken = toSpeakable(t.replace(/\{\w+\}/g, "3"));
      expect(spoken, `${t} → ${spoken}`).not.toMatch(/は(?=[\s、。！？]|$)|を|cm|[a-zA-Z]/);
    }
  });
});
