import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeCodeBlocks } from "./execute.ts";

describe("executeCodeBlocks", () => {
  it("runs powershell and captures stdout", async () => {
    const [r] = await executeCodeBlocks([
      { language: "powershell", code: "Write-Output 'cov-ps'" },
    ]);
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /cov-ps/);
  });

  it("runs multiple blocks", async () => {
    const rs = await executeCodeBlocks([
      { language: "powershell", code: "Write-Output a" },
      { language: "powershell", code: "Write-Output b" },
    ]);
    assert.equal(rs.length, 2);
    assert.equal(rs[0].exitCode, 0);
    assert.equal(rs[1].exitCode, 0);
  });

  it("non-zero exit code", async () => {
    const [r] = await executeCodeBlocks([
      { language: "node", code: "process.exit(7)" },
    ]);
    assert.equal(r.exitCode, 7);
  });
});
