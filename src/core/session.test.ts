import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runSession } from "./session.ts";
import type { ChatClient, SessionIO } from "./types.ts";

describe("runSession", () => {
  it("waits for user prompt without boot message", async () => {
    const prompts: string[] = [];
    let replyIndex = 0;
    const replies = ["pong"];

    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt(p: string) {
        prompts.push(p);
      },
      async waitForResponse() {
        const r = replies[Math.min(replyIndex, replies.length - 1)] ?? "";
        replyIndex += 1;
        return r;
      },
    };

    const inputs = ["hello", "exit"];
    let inputIndex = 0;
    const writes: string[] = [];
    const io: SessionIO = {
      async read() {
        return inputs[inputIndex++] ?? "exit";
      },
      write(m: string) {
        writes.push(m);
      },
    };

    await runSession(client, io, { responseTimeoutMs: 500 });

    assert.equal(prompts[0], "hello");
    assert.ok(prompts.some((p) => p.includes("Task is not finished")));
  });

  it("tries all models on rate limit then surfaces last error", async () => {
    const tried: string[] = [];
    const prompts: string[] = [];
    let waits = 0;

    const client: ChatClient = {
      name: "fake",
      url: "http://x",
      async open() {},
      async sendPrompt(p: string) {
        prompts.push(p);
      },
      async waitForResponse() {
        waits += 1;
        // すべて制限
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

    const inputs = ["task", "exit"];
    let inputIndex = 0;
    const writes: string[] = [];
    const io: SessionIO = {
      async read() {
        return inputs[inputIndex++] ?? "exit";
      },
      write(m: string) {
        writes.push(m);
      },
    };

    await runSession(client, io, { responseTimeoutMs: 500 });

    assert.deepEqual(tried, ["自動", "Expert", "高速"]);
    assert.ok(writes.some((w) => w.includes("利用可能なモデルがありません")));
    assert.ok(waits >= 1 + 3);
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
        if (waits === 1) {
          return "You've reached your limit of 40 Grok questions";
        }
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

    const inputs = ["task", "exit"];
    let inputIndex = 0;
    const io: SessionIO = {
      async read() {
        return inputs[inputIndex++] ?? "exit";
      },
      write() {},
    };

    await runSession(client, io, { responseTimeoutMs: 500 });

    assert.deepEqual(tried, ["A"]);
    assert.equal(waits, 2);
  });
});
