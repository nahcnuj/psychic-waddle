import type { ChatClient, SessionIO } from "./types.ts";
import { blockKey, extractCodeBlocks } from "../utils/code-blocks.ts";
import { executeCodeBlocks, type ExecResult } from "../utils/execute.ts";
import { isRateLimited } from "../providers/x-grok.ts";

export type SessionOptions = {
  responseTimeoutMs: number;
};

export const CONTINUE_NUDGE = [
  "Need the next runnable code block to continue this task (prefer powershell on Windows).",
  "Goal: tests/typecheck pass and a pull request is opened.",
].join("\n");

export function formatExecFeedback(results: ExecResult[]): string {
  const parts: string[] = [
    "These outputs came from executing the code blocks below, in order.",
    "Continue the original coding task. Return ONLY the next runnable code block.",
    "Continue until tests/typecheck pass and a PR is opened.",
    "",
  ];

  for (const r of results) {
    parts.push("Executed [" + (r.language || "shell") + "] exit=" + String(r.exitCode));
    parts.push(r.code.replace(/\s+$/, ""));
    parts.push("output:");
    parts.push((r.output ?? (r.stdout + r.stderr)).trimEnd() || "(empty)");
    parts.push("");
  }

  return parts.join("\n");
}

function looksLikeFinished(results: ExecResult[]): boolean {
  const text = results
    .map((r) => r.output ?? (r.stdout + String.fromCharCode(10) + r.stderr))
    .join(String.fromCharCode(10));
  const hasPr =
    /https:\/\/github\.com\/[^\s]+\/pull\/\d+/i.test(text) ||
    /pull request (created|opened)/i.test(text) ||
    /Creating pull request/i.test(text);
  const passed =
    /All checks (have )?passed/i.test(text) ||
    /\b(status|checks?)\b[^\n]*\bpassed\b/i.test(text);
  return results.every((r) => r.exitCode === 0) && hasPr && passed;
}

async function sendAndWait(
  client: ChatClient,
  io: SessionIO,
  prompt: string,
  timeoutMs: number,
): Promise<string> {
  io.write("送信中...");
  await client.sendPrompt(prompt);
  io.write("応答待ち...");
  return client.waitForResponse(timeoutMs);
}

type SendResult = {
  response: string;
  usedModelFallback: boolean;
};

async function sendWithModelFallback(
  client: ChatClient,
  io: SessionIO,
  prompt: string,
  timeoutMs: number,
): Promise<SendResult> {
  let response = await sendAndWait(client, io, prompt, timeoutMs);
  if (!isRateLimited(response)) {
    return { response, usedModelFallback: false };
  }

  if (!client.listModels || !client.selectModel) {
    return { response, usedModelFallback: true };
  }

  const models = await client.listModels();
  if (models.length === 0) {
    io.write("[INFO] 切替可能なモデル候補が見つかりません");
    return { response, usedModelFallback: true };
  }

  io.write("[INFO] レート制限。モデルを順に試行: " + models.join(", "));
  let last = response;
  for (const m of models) {
    io.write("[INFO] try model: " + m);
    const ok = await client.selectModel(m);
    if (!ok) continue;
    last = await sendAndWait(client, io, prompt, timeoutMs);
    if (!isRateLimited(last)) {
      io.write("[INFO] 利用可能: " + m);
      return { response: last, usedModelFallback: true };
    }
  }

  io.write("[ERROR] 利用可能なモデルがありません");
  return { response: last, usedModelFallback: true };
}

export async function runSession(
  client: ChatClient,
  io: SessionIO,
  options: SessionOptions,
): Promise<void> {
  io.write("========================================");
  io.write("Provider: " + client.name);
  io.write("URL: " + client.url);
  io.write("コーディングエージェント: タスク中はコードが来るまで継続要求");
  io.write("終了: exit / quit");
  io.write("========================================");

  await client.open();

  io.write("");
  io.write("準備完了。タスクを入力してください。");
  io.write("");

  const executed = new Set<string>();
  let pending: string | null = null;
  let inTask = false;
  let autoContinueLeft = 0;
  const AUTO_CONTINUE_MAX = 12;

  while (true) {
    let prompt: string;
    if (pending !== null) {
      prompt = pending;
      pending = null;
    } else {
      prompt = (await io.read("あなた > ")).trim();
      if (!prompt) continue;
      if (prompt.toLowerCase() === "exit" || prompt.toLowerCase() === "quit") break;
      inTask = true;
      autoContinueLeft = AUTO_CONTINUE_MAX;
    }

    try {
      const { response, usedModelFallback } = await sendWithModelFallback(
        client,
        io,
        prompt,
        options.responseTimeoutMs,
      );

      io.write("");
      io.write("Grok >");
      io.write(response);
      io.write("");

      if (isRateLimited(response)) {
        inTask = false;
        autoContinueLeft = 0;
        continue;
      }

      const blocks = extractCodeBlocks(response).filter((b) => !executed.has(blockKey(b)));

      if (blocks.length === 0) {
        if (usedModelFallback) {
          inTask = false;
          autoContinueLeft = 0;
          continue;
        }
        if (inTask && autoContinueLeft > 0) {
          autoContinueLeft -= 1;
          io.write("[INFO] コードなし。継続要求 (rest=" + autoContinueLeft + ")");
          pending = CONTINUE_NUDGE;
          continue;
        }
        inTask = false;
        continue;
      }

      for (const b of blocks) executed.add(blockKey(b));

      io.write("コードブロック " + blocks.length + " 件を実行します...");
      const results = await executeCodeBlocks(blocks);
      for (const r of results) {
        io.write("Executed [" + (r.language || "shell") + "] exit=" + String(r.exitCode));
        io.write(r.code.replace(/\s+$/, ""));
        const combined = (r.output ?? (r.stdout + r.stderr)).trimEnd();
        if (combined) io.write(combined);
        io.write("");
      }

      if (looksLikeFinished(results)) {
        io.write("[INFO] PR status passed を検出。ユーザー入力待ちに戻ります。");
        inTask = false;
        autoContinueLeft = 0;
        pending = null;
        continue;
      }

      pending = formatExecFeedback(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      io.write("[ERROR] " + message);
      pending = null;
    }
  }

  io.write("セッションを終了しました。");
}