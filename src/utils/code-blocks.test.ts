import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCodeBlocks } from "./code-blocks.ts";

describe("extractCodeBlocks", () => {
  it("returns empty when no fences", () => {
    assert.deepEqual(extractCodeBlocks("hello pong"), []);
  });

  it("extracts language and code", () => {
    const text = "see:\n```js\nconsole.log(1)\n```\n";
    assert.deepEqual(extractCodeBlocks(text), [
      { language: "js", code: "console.log(1)" },
    ]);
  });

  it("extracts unfenced language line + code without UI chips", () => {
    const text = [
      "powershell",
      'Write-Output "hello from grok"',
      "Write-Hostの使い方",
      "PowerShellの出力パイプライン",
      "もっとよくシンキングする",
    ].join("\n");
    const blocks = extractCodeBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, "powershell");
    assert.equal(blocks[0].code, 'Write-Output "hello from grok"');
  });
});
