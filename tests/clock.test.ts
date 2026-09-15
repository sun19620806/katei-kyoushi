import { describe, expect, it } from "vitest";
import { hourFromAngle, hourHandAngle, minuteFromAngle, pickHand } from "../src/domain/clockMath";

describe("とけいを あわせる", () => {
  it("はりを あわせる じゅんばんに かかわらず、同じ 位置なら 同じ 時こく", () => {
    for (let h = 1; h <= 12; h++) {
      for (let m = 0; m < 60; m += 5) {
        // 正しい 位置
        expect(hourFromAngle(hourHandAngle(h, m), m), `${h}:${m} ただしい位置`).toBe(h);
        // すうじの 上に おいた（分の ぶん すすめて いない）
        expect(hourFromAngle((h % 12) * 30, m), `${h}:${m} すうじの上`).toBe(h);
        // 少し ずれても（±4度。分が 大きいと となりの 時と 区別が つかないので 30分まで）
        if (m <= 30) {
          expect(hourFromAngle(hourHandAngle(h, m) + 4, m), `${h}:${m} +4`).toBe(h);
          expect(hourFromAngle((h % 12) * 30 - 4, m), `${h}:${m} -4`).toBe(h);
        }
      }
    }
  });

  it("ながい はりは 5分きざみ", () => {
    expect(minuteFromAngle(0)).toBe(0);
    expect(minuteFromAngle(88)).toBe(15);
    expect(minuteFromAngle(356)).toBe(0);
    expect(minuteFromAngle(270)).toBe(45);
  });

  it("さわった 所に 近い はりを うごかす", () => {
    // 3時45分：みじかい はりは 約112度、ながい はりは 270度
    expect(pickHand(110, 0.5, 3, 45)).toBe("hour");
    expect(pickHand(268, 0.5, 3, 45)).toBe("minute");
    expect(pickHand(268, 0.9, 3, 45)).toBe("minute");
    expect(pickHand(115, 0.3, 3, 45)).toBe("hour");
  });
});
