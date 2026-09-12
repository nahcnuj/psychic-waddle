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

  it("drops suggestion chips and thinking UI from issue 37", () => {
    const labels = filterModelLabels([
      "github.com",
      "シンキング結果",
      "Explore biome plugin configuration",
      "Investigate biome lint rules",
      "Explain biome lint rules",
      "Fix PowerShell syntax errors",
      "Return only the next runnable code block",
      "6秒間シンキングしました",
      "PowerShell Error Handling",
      "Git Branch Management",
      "Commit and open PR for all changes",
      "Grok 4",
      "自動",
      "Expert",
    ]);
    assert.deepEqual(labels, ["Grok 4", "自動", "Expert"]);
  });
});