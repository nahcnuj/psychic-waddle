import { spawn } from "node:child_process";
import type { CodeBlock } from "./code-blocks.ts";

export type ExecResult = {
  language: string;
  code: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

function commandFor(block: CodeBlock): { file: string; args: string[]; input?: string } {
  const lang = block.language;
  const code = block.code;

  if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "zsh") {
    return { file: "bash", args: ["-lc", code] };
  }
  if (lang === "powershell" || lang === "ps1" || lang === "pwsh") {
    return { file: "powershell", args: ["-NoProfile", "-Command", code] };
  }
  if (lang === "cmd" || lang === "bat") {
    return { file: "cmd.exe", args: ["/c", code] };
  }
  if (lang === "javascript" || lang === "js" || lang === "node") {
    return { file: "node", args: ["-e", code] };
  }
  if (lang === "typescript" || lang === "ts") {
    return { file: "node", args: ["--import", "tsx", "-e", code] };
  }
  if (lang === "python" || lang === "py") {
    return { file: "python", args: ["-c", code] };
  }

  // 言語タグなし / 不明: シェルとして実行（Windows は powershell）
  if (process.platform === "win32") {
    return { file: "powershell", args: ["-NoProfile", "-Command", code] };
  }
  return { file: "bash", args: ["-lc", code] };
}

export function executeCodeBlock(block: CodeBlock, timeoutMs = 60000): Promise<ExecResult> {
  const { file, args } = commandFor(block);

  return new Promise((resolve) => {
    const child = spawn(file, args, {
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const armTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!settled) {
          child.kill();
          settled = true;
          resolve({
            language: block.language,
            code: block.code,
            stdout,
            stderr: stderr + "\n[timeout]",
            exitCode: null,
          });
        }
      }, timeoutMs);
    };

    armTimer();

    child.stdout?.on("data", (d) => {
      stdout += String(d);
      armTimer();
    });
    child.stderr?.on("data", (d) => {
      stderr += String(d);
      armTimer();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        language: block.language,
        code: block.code,
        stdout,
        stderr: stderr + String(err),
        exitCode: 1,
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        language: block.language,
        code: block.code,
        stdout,
        stderr,
        exitCode: code,
      });
    });
  });
}

export async function executeCodeBlocks(blocks: CodeBlock[]): Promise<ExecResult[]> {
  const results: ExecResult[] = [];
  for (const block of blocks) {
    results.push(await executeCodeBlock(block));
  }
  return results;
}
