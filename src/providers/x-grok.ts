import type { Page, Locator } from "playwright";
import type { ChatClient } from "../core/types.ts";
import { setTimeout as sleep } from 'node:timers/promises';
import { filterModelLabels, isRateLimited } from "./model-utils.ts";
import { hasCodeFence, isIntermediateResponse, isOutputComplete } from "./response-complete.ts";

export { isRateLimited, filterModelLabels };

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
  return page.evaluate(() => (document.body?.innerText ?? "").trim());
}

function pageDelta(before: string, after: string): string {
  if (!before) return after;
  if (after.startsWith(before)) return after.slice(before.length).trim();
  let i = 0;
  const n = Math.min(before.length, after.length);
  while (i < n && before[i] === after[i]) i += 1;
  const delta = after.slice(i).trim();
  return delta.length > 0 ? delta : after;
}

async function openModelPicker(page: Page): Promise<void> {
  const candidates = page.locator(
    [
      '[data-testid*="model" i]',
      '[aria-label*="model" i]',
      '[aria-label*="モデル"]',
      'button:has-text("Auto")',
      'button:has-text("Fast")',
      'button:has-text("自動")',
      'button:has-text("高速")',
      'button:has-text("Expert")',
      'button:has-text("エキスパート")',
      'button:has-text("Thinking")',
      'button:has-text("シンキング")',
      'button:has-text("Grok")',
    ].join(", "),
  );
  const n = await candidates.count();
  for (let i = 0; i < Math.min(n, 8); i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.click({ timeout: 2000 }).catch(() => undefined);
    await sleep(400);
    const menu = page.locator('[role="menu"], [role="listbox"], [data-testid*="model" i]');
    if ((await menu.count()) > 0) break;
  }
}

export async function listModelLabels(page: Page): Promise<string[]> {
  await openModelPicker(page);

  const raw = await page.evaluate(() => {
    const out: string[] = [];
    const nodes = document.querySelectorAll(
      [
        '[role="menuitem"]',
        '[role="option"]',
        '[role="radio"]',
        '[role="menuitemradio"]',
        '[data-testid*="model" i]',
        '[data-testid*="mode" i]',
        'div[role="menu"] button',
        'div[role="listbox"] button',
        'div[role="listbox"] [role="option"]',
      ].join(","),
    );
    for (const el of nodes) {
      out.push(el.textContent ?? "");
    }
    if (out.length === 0) {
      for (const el of document.querySelectorAll("button")) {
        out.push(el.textContent ?? "");
      }
    }
    return out;
  });

  await page.keyboard.press("Escape").catch(() => undefined);
  await sleep(200);

  return filterModelLabels(raw);
}

export async function selectModel(page: Page, name: string): Promise<boolean> {
  await openModelPicker(page);

  const tryClick = async (locator: Locator): Promise<boolean> => {
    const c = await locator.count();
    for (let i = 0; i < c; i++) {
      const el = locator.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      await el.click({ timeout: 3000 });
      await sleep(500);
      return true;
    }
    return false;
  };

  if (await tryClick(page.getByRole("menuitem", { name, exact: true }))) return true;
  if (await tryClick(page.getByRole("option", { name, exact: true }))) return true;
  if (await tryClick(page.getByRole("radio", { name, exact: true }))) return true;
  if (await tryClick(page.getByRole("button", { name, exact: true }))) return true;
  if (await tryClick(page.getByText(name, { exact: true }))) return true;

  const fuzzy = page.locator(
    `[role="menuitem"]:has-text("${name}"), [role="option"]:has-text("${name}"), button:has-text("${name}")`,
  );
  if (await tryClick(fuzzy)) return true;

  await page.keyboard.press("Escape").catch(() => undefined);
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
        if (await findInput(page)) return;
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

    async waitForResponse(timeoutMs = 180000) {
      const minWaitAfterChangeMs = 6000;
      const stableNeed = 8;
      let lastText = "";
      let stableCount = 0;
      let changedAt: number | null = null;
      let lastLog = 0;
      // Idle timeout: only fires when no new output for timeoutMs
      let deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const current = await readPageText(page);
        const changed = current !== textBeforeSend && current.length > 0;
        const intermediate = isIntermediateResponse(current);
        const coded = hasCodeFence(current);

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
              coded,
          );
          lastLog = Date.now();
        }

        if (!changed) {
          stableCount = 0;
          lastText = "";
          await sleep(500);
          continue;
        }

        // Receiving output -> extend idle deadline
        if (current !== lastText) {
          deadline = Date.now() + timeoutMs;
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
          const need = coded ? 3 : stableNeed;
          const complete = isOutputComplete({ text: current, textBeforeSend, stopControlVisible: false, composerEnabled: true, generatingIndicatorVisible: intermediate }); if (stableCount >= need && waitedEnough && complete) {
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
    }
  };
}

