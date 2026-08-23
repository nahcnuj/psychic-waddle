import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterModelLabels, isRateLimited } from "./model-utils.ts";

describe("isRateLimited", () => {
  it("detects english limit message", () => {
    assert.equal(
      isRateLimited("You've reached your limit of 40 Grok questions per 2 hours"),
      true,
    );
  });

  it("detects japanese upgrade prompt", () => {
    assert.equal(isRateLimited("プレミアムプラスでGrokをさらに活用する"), true);
  });

  it("returns false for normal reply", () => {
    assert.equal(isRateLimited("powershell\nWrite-Output 1"), false);
  });
});

describe("filterModelLabels", () => {
  it("keeps model-like labels including Expert", () => {
    const labels = filterModelLabels([
      "自動",
      "高速",
      "Expert",
      "エキスパート",
      "もっとよくシンキングする",
      "アップグレード",
      "新しいポストを表示",
      "Auto",
      "Auto",
    ]);
    assert.deepEqual(labels, [
      "自動",
      "高速",
      "Expert",
      "エキスパート",
      "もっとよくシンキングする",
      "Auto",
    ]);
  });

  it("drops empty and too long", () => {
    assert.deepEqual(filterModelLabels(["", "x", "a".repeat(50)]), []);
  });
});
