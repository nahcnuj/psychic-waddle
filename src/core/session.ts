import type { ChatClient, SessionIO } from "./types.ts";
import { blockKey, extractCodeBlocks } from "../utils/code-blocks.ts";
import { executeCodeBlocks, type ExecResult } from "../utils/execute.ts";
import { isRateLimited } from "../providers/x-grok.ts";

export type SessionOptions = {
  responseTimeoutMs: number;
};

const CONTINUE_NUDGE = [
  "No executable code block was found in the last response.",
  "Please output ONLY the next runnable code block (prefer powershell on Windows).",
  "No explanations.",
  "Continue until tests/typecheck pass and a PR is created.",
].join("\n");

function formatExecFeedback(results: ExecResult[]): string {
  const parts: string[] = [
    "Execution results (continue; return NEXT code block only):",
    "Continue the task: return the NEXT code block only.",
    "Continue until tests/typecheck pass and a PR is opened.",
    "",
  ];

  for (const r of results) {
    parts.push("--- exec [" + (r.language || "shell") + "] exit=" + String(r.exitCode) + " ---");
    parts.push("stdout:");
    parts.push(r.stdout.trimEnd() || "(empty)");
    parts.push("stderr:");
    parts.push(r.stderr.trimEnd() || "(empty)");
    parts.push("");
  }

  return parts.join("\n");
}

function looksLikeFinished(results: ExecResult[]): boolean {
  return results.some(
    (r) =>
      r.exitCode === 0 &&
      (/\[(main|master).+\].+/.test(r.stdout) || /files? changed/i.test(r.stdout) || /pull request created/i.test(r.stdout) || /Creating pull request/i.test(r.stdout)),
  );
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
  /** レート制限を検知しモデル切替を経た */
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
        // レート制限回避直後のコードなしは継続しない（モデル切替の結果をユーザーに返す）
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
        io.write("--- exec [" + (r.language || "shell") + "] exit=" + String(r.exitCode) + " ---");
        if (r.stdout.trim()) io.write(r.stdout.trimEnd());
        if (r.stderr.trim()) io.write("[stderr]\n" + r.stderr.trimEnd());
        io.write("");
      }

      if (looksLikeFinished(results)) {
        io.write("[INFO] commit 成功を検出。ユーザー入力待ちに戻ります。");
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
