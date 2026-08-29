import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSession } from "./session.ts";
import type { ChatClient, SessionIO } from "./types.ts";

function ioFrom(inputs: string[]): SessionIO & { writes: string[] } {
  let i = 0;
  const writes: string[] = [];
  return {
    writes,
    async read() {
      return inputs[i++] ?? "exit";
    },
    write(m: string) {
      writes.push(m);
    },
  };
}

describe("runSession", () => {
  it("waits for user prompt without boot message", async () => {
    const prompts: string[] = [];
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt(p: string) {
        prompts.push(p);
      },
      async waitForResponse() {
        return "pong without code";
      },
    };
    await runSession(client, ioFrom(["hello", "exit"]), { responseTimeoutMs: 500 });
    assert.equal(prompts[0], "hello");
    assert.ok(prompts.some((p) => p.includes("Need the next runnable code block")));
  });

  it("tries all models on rate limit then surfaces last error", async () => {
    const tried: string[] = [];
    let waits = 0;
    const io = ioFrom(["task", "exit"]);
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt() {},
      async waitForResponse() {
        waits += 1;
        return "You've reached your limit of 40 Grok questions per 2 hours";
      },
      async listModels() {
        return ["自動", "Expert", "高速"];
      },
      async selectModel(name: string) {
        tried.push(name);
        return true;
      },
    };
    await runSession(client, io, { responseTimeoutMs: 500 });
    assert.deepEqual(tried, ["自動", "Expert", "高速"]);
    assert.equal(waits, 4);
    assert.ok(io.writes.some((w) => w.includes("利用可能なモデルがありません")));
  });

  it("stops model fallback when one succeeds", async () => {
    const tried: string[] = [];
    let waits = 0;
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt() {},
      async waitForResponse() {
        waits += 1;
        if (waits === 1) return "You've reached your limit of 40 Grok questions";
        return "ok no code";
      },
      async listModels() {
        return ["A", "B", "C"];
      },
      async selectModel(name: string) {
        tried.push(name);
        return true;
      },
    };
    await runSession(client, ioFrom(["task", "exit"]), { responseTimeoutMs: 500 });
    assert.deepEqual(tried, ["A"]);
    assert.equal(waits, 2);
  });

  it("after code exec feeds back results", async () => {
    const prompts: string[] = [];
    let waits = 0;
    const io = ioFrom(["do", "exit"]);
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt(p: string) {
        prompts.push(p);
      },
      async waitForResponse() {
        waits += 1;
        if (waits === 1) {
          return ["```bash", "echo cov-feed", "```"].join("\n");
        }
        return "no more";
      },
    };
    await runSession(client, io, { responseTimeoutMs: 5000 });
    assert.ok(io.writes.some((w) => w.includes("コードブロック")));
    assert.ok(prompts.some((p) => p.includes("These outputs came from executing") || p.includes("Executed [") || p.includes("exit=")));
  });

    it("stops task after PR status passed", async () => {
    const prompts: string[] = [];
    const io = ioFrom(["open pr", "exit"]);
    const client = { name: "fake", url: "http://x", async open() {}, async sendPrompt(p: string) { prompts.push(p); }, async waitForResponse() { return ["```bash","echo Creating pull request","echo https://github.com/nahcnuj/psychic-waddle/pull/99","echo All checks have passed","```"].join(String.fromCharCode(10)); } };
    await runSession(client, io, { responseTimeoutMs: 5000 });
    if (!io.writes.some((w) => w.includes("PR status passed"))) throw new Error("missing finish log");
    if (prompts.some((p) => p.includes("Command results below"))) throw new Error("should not continue");
  });
it("continues after send error", async () => {
    let n = 0;
    const writes: string[] = [];
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt() {
        n += 1;
        if (n === 1) throw new Error("send failed");
      },
      async waitForResponse() {
        return "ok";
      },
    };
    const inputs = ["hello", "exit"];
    let i = 0;
    const io: SessionIO = {
      async read() {
        return inputs[i++] ?? "exit";
      },
      write(m: string) {
        writes.push(m);
      },
    };
    await runSession(client, io, { responseTimeoutMs: 500 });
    assert.ok(writes.some((w) => w.includes("[ERROR] send failed")));
  });

  it("rate limit with empty model list", async () => {
    const io = ioFrom(["task", "exit"]);
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt() {},
      async waitForResponse() {
        return "You've reached your limit of 40 Grok questions";
      },
      async listModels() {
        return [];
      },
      async selectModel() {
        return false;
      },
    };
    await runSession(client, io, { responseTimeoutMs: 500 });
    assert.ok(io.writes.some((w) => w.includes("候補が見つかりません")));
  });

  it("rate limit selectModel fails then continues", async () => {
    const tried: string[] = [];
    const io = ioFrom(["task", "exit"]);
    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt() {},
      async waitForResponse() {
        return "You've reached your limit of 40 Grok questions";
      },
      async listModels() {
        return ["X", "Y"];
      },
      async selectModel(name: string) {
        tried.push(name);
        return false;
      },
    };
    await runSession(client, io, { responseTimeoutMs: 500 });
    assert.deepEqual(tried, ["X", "Y"]);
    assert.ok(io.writes.some((w) => w.includes("利用可能なモデルがありません")));
  });
});

