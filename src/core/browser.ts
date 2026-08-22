import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { AppConfig } from "./types.ts";
import { ensureUserDataDir, resolveExecutable } from "../browsers/index.ts";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

async function waitForCdp(port: number, timeoutMs = 15000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (res.ok) {
        const json = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (json.webSocketDebuggerUrl) {
          return json.webSocketDebuggerUrl;
        }
      }
    } catch {
      // not ready
    }
    await sleep(200);
  }
  throw new Error("CDP endpoint not ready on port " + port);
}

export async function createBrowser(config: AppConfig): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}> {
  if (config.cdpUrl) {
    const browser = await chromium.connectOverCDP(config.cdpUrl, { timeout: 30000 });
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return {
      browser,
      context,
      page,
      close: async () => {
        await browser.close();
      },
    };
  }

  const executablePath = resolveExecutable(config.browser);
  if (!executablePath) {
    throw new Error("Executable not found for browser: " + config.browser);
  }

  const copyPasswords = !process.argv.includes("--no-passwords");
  const userDataDir = ensureUserDataDir(
    config.browser,
    config.userDataDir,
    config.profileDirectory,
    copyPasswords,
  );

  const port = 9333;
  const child: ChildProcess = spawn(
    executablePath,
    [
      "--remote-debugging-port=" + port,
      "--user-data-dir=" + userDataDir,
      "--profile-directory=" + config.profileDirectory,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );

  try {
    const wsUrl = await waitForCdp(port);
    // http 経由より ws 直指定の方が安定することがある
    const browser = await chromium.connectOverCDP(wsUrl, { timeout: 30000 });
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page =
      context.pages().find((p) => !p.isClosed()) ?? (await context.newPage());

    return {
      browser,
      context,
      page,
      close: async () => {
        await browser.close().catch(() => undefined);
        if (!child.killed) child.kill();
      },
    };
  } catch (err) {
    if (!child.killed) child.kill();
    throw err;
  }
}
