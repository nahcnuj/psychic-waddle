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

  it("extracts unfenced without English tip chips", () => {
    const text = [
      "powershell",
      "Get-Content src\\core\\session.ts",
      "Investigate PowerShell command aliasing",
      "Explore TypeScript type definitions",
      "高速",
    ].join("\n");
    const blocks = extractCodeBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].code, "Get-Content src\\core\\session.ts");
  });
});
