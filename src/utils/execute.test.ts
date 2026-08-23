import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeCodeBlocks } from "./execute.ts";

describe("executeCodeBlocks", () => {
  it("runs bash and captures stdout", async () => {
    const [r] = await executeCodeBlocks([
      { language: "bash", code: "echo cov-ps" },
    ]);
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /cov-ps/);
  });

  it("runs multiple blocks", async () => {
    const rs = await executeCodeBlocks([
      { language: "bash", code: "echo a" },
      { language: "bash", code: "echo b" },
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
