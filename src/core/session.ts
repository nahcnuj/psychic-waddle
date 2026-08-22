import type { ChatClient, SessionIO } from "./types.ts";
import { blockKey, extractCodeBlocks } from "../utils/code-blocks.ts";
import { executeCodeBlocks, type ExecResult } from "../utils/execute.ts";

export type SessionOptions = {
  responseTimeoutMs: number;
};

function formatExecFeedback(results: ExecResult[]): string {
  const parts: string[] = [
    "コードを実行しました。結果は以下です。",
    "必要なら続きのコードだけを返してください。不要なら短く完了とだけ返してください。",
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

export async function runSession(
  client: ChatClient,
  io: SessionIO,
  options: SessionOptions,
): Promise<void> {
  io.write("========================================");
  io.write("Provider: " + client.name);
  io.write("URL: " + client.url);
  io.write("Grok の入力欄が出るまで待ちます（ログインが必要な場合はブラウザで完了してください）");
  io.write("応答にコードブロックがあれば自動実行し、結果を Grok に返します");
  io.write("終了: exit / quit");
  io.write("========================================");

  await client.open();

  io.write("");
  io.write("準備完了。ループを開始します。");
  io.write("");

  const executed = new Set<string>();
  let pending: string | null = null;

  while (true) {
    let prompt: string;
    if (pending !== null) {
      prompt = pending;
      pending = null;
      io.write("実行結果を Grok に送信中...");
    } else {
      prompt = (await io.read("あなた > ")).trim();
      if (!prompt) continue;
      if (prompt.toLowerCase() === "exit" || prompt.toLowerCase() === "quit") {
        break;
      }
    }

    try {
      io.write("送信中...");
      await client.sendPrompt(prompt);

      io.write("応答待ち...");
      const response = await client.waitForResponse(options.responseTimeoutMs);

      io.write("");
      io.write("Grok >");
      io.write(response);
      io.write("");

      const blocks = extractCodeBlocks(response).filter((b) => {
        const key = blockKey(b);
        if (executed.has(key)) return false;
        return true;
      });

      if (blocks.length === 0) {
        continue;
      }

      for (const b of blocks) {
        executed.add(blockKey(b));
      }

      io.write("コードブロック " + blocks.length + " 件を実行します...");
      const results = await executeCodeBlocks(blocks);
      for (const r of results) {
        io.write("--- exec [" + (r.language || "shell") + "] exit=" + String(r.exitCode) + " ---");
        if (r.stdout.trim()) io.write(r.stdout.trimEnd());
        if (r.stderr.trim()) io.write("[stderr]\n" + r.stderr.trimEnd());
        io.write("");
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
