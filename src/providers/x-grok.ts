import type { Page, Locator } from "playwright";
import type { ChatClient } from "../core/types.ts";
import { sleep } from "../utils/wait.ts";

async function findInput(page: Page): Promise<Locator | null> {
  const byPlaceholder = page.getByPlaceholder(/お尋ね|Ask|Grok|Message|質問/i);
  if ((await byPlaceholder.count()) > 0) {
    const loc = byPlaceholder.last();
    if (await loc.isVisible().catch(() => false)) return loc;
  }

  const textareas = page.locator("textarea");
  const n = await textareas.count();
  for (let i = 0; i < n; i++) {
    const loc = textareas.nth(i);
    if (await loc.isVisible().catch(() => false)) return loc;
  }

  return null;
}

async function readPageText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const body = (document.body?.innerText ?? "").trim();
    const codeBits: string[] = [];
    for (const el of document.querySelectorAll("pre, code")) {
      const t = (el.textContent ?? "").trim();
      if (t.length > 0) codeBits.push(t);
    }
    const fenced = codeBits
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .filter((t) => t.length >= 3)
      .map((t) => {
        if (t.includes("```")) return t;
        const lang = /Write-Output|\$[a-zA-Z]|Get-/i.test(t)
          ? "powershell"
          : /console\.|const |let |function /i.test(t)
            ? "js"
            : "";
        return "```" + lang + "\n" + t + "\n```";
      })
      .join("\n\n");
    if (!fenced) return body;
    if (body.includes(fenced) || codeBits.every((b) => body.includes(b))) return body;
    return body + "\n\n" + fenced;
  });
}

function pageDelta(before: string, after: string): string {
  if (!before) return after;
  if (after.startsWith(before)) return after.slice(before.length).trim();
  // 差し替え型 UI: 共通接頭を除いた差分
  let i = 0;
  const n = Math.min(before.length, after.length);
  while (i < n && before[i] === after[i]) i += 1;
  const delta = after.slice(i).trim();
  return delta.length > 0 ? delta : after;
}

function hasCodeFence(text: string): boolean {
  return /```[\s\S]*?```/.test(text);
}

function isIntermediateResponse(text: string): boolean {
  if (/thinking about your request/i.test(text)) return true;
  if (/Thinking\.\.\./i.test(text)) return true;
  if (/回答を生成中/.test(text)) return true;
  if (/考えています/.test(text)) return true;
  return false;
}

export function createXGrokClient(page: Page, url: string): ChatClient {
  let textBeforeSend = "";

  return {
    name: "x-grok",
    url,

    async open() {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        const input = await findInput(page);
        if (input) return;
        await sleep(1000);
      }
      throw new Error("Grok input not found (login may be required)");
    },

    async sendPrompt(prompt: string) {
      const input = await findInput(page);
      if (!input) throw new Error("Input field not found");

      textBeforeSend = await readPageText(page);
      await input.click();
      await sleep(200);
      await input.fill(prompt);
      await sleep(200);
      await page.keyboard.press("Enter");
    },

    async waitForResponse(timeoutMs = 120000) {
      const start = Date.now();
      const minWaitAfterChangeMs = 5000;
      const stableNeed = 6;
      let lastText = "";
      let stableCount = 0;
      let changedAt: number | null = null;
      let lastLog = 0;

      while (Date.now() - start < timeoutMs) {
        const current = await readPageText(page);
        const changed = current !== textBeforeSend && current.length > 0;
        const intermediate = isIntermediateResponse(current);

        if (Date.now() - lastLog > 3000) {
          console.log(
            "[debug] len=" +
              current.length +
              " changed=" +
              changed +
              " stable=" +
              stableCount +
              " intermediate=" +
              intermediate +
              " hasCode=" +
              hasCodeFence(current),
          );
          lastLog = Date.now();
        }

        if (!changed) {
          stableCount = 0;
          lastText = "";
          await sleep(500);
          continue;
        }

        if (changedAt === null) changedAt = Date.now();

        if (intermediate) {
          stableCount = 0;
          lastText = current;
          await sleep(500);
          continue;
        }

        if (current === lastText) {
          stableCount += 1;
          const waitedEnough =
            changedAt !== null && Date.now() - changedAt >= minWaitAfterChangeMs;
          const need = hasCodeFence(current) ? 3 : stableNeed;
          if (stableCount >= need && waitedEnough) {
            return pageDelta(textBeforeSend, current);
          }
          if (
            hasCodeFence(current) &&
            stableCount >= 3 &&
            changedAt !== null &&
            Date.now() - changedAt >= 2500
          ) {
            return pageDelta(textBeforeSend, current);
          }
        } else {
          lastText = current;
          stableCount = 0;
        }

        await sleep(500);
      }

      if (lastText && !isIntermediateResponse(lastText)) {
        return pageDelta(textBeforeSend, lastText);
      }
      throw new Error("Timed out waiting for response");
    },
  };
}
