import type { Page } from 'playwright';
import type { ChatClient } from '../core/types.js';
import { sleep } from '../utils/wait.js';

const INPUT_SELECTORS = [
  'textarea[placeholder*="Ask"]',
  'textarea[placeholder*="Grok"]',
  'textarea[placeholder*="Message"]',
  'textarea',
  '[contenteditable="true"]',
  'div[role="textbox"]',
];

const MESSAGE_SELECTORS = [
  '[data-testid*="message"]',
  '[data-testid*="grok"]',
  '[class*="message"]',
  '[class*="response"]',
  '[class*="Message"]',
];

export function createXGrokClient(page: Page, url: string): ChatClient {
  return {
    name: 'x-grok',
    url,

    async open() {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    },

    async sendPrompt(prompt: string) {
      let input = null;
      for (const selector of INPUT_SELECTORS) {
        const locator = page.locator(selector).last();
        const count = await locator.count();
        const visible = count > 0 ? await locator.isVisible().catch(() => false) : false;
        if (visible) {
          input = locator;
          break;
        }
      }

      if (!input) {
        throw new Error('Input field not found');
      }

      await input.click();
      await input.fill('');
      await input.fill(prompt);
      await page.keyboard.press('Enter');
    },

    async waitForResponse(timeoutMs = 90000) {
      const start = Date.now();
      let lastText = '';
      let stableCount = 0;

      while (Date.now() - start < timeoutMs) {
        const messages = page.locator(MESSAGE_SELECTORS.join(', '));
        const count = await messages.count();

        if (count === 0) {
          await sleep(800);
          continue;
        }

        const latest = messages.nth(count - 1);
        let text = '';
        try {
          text = (await latest.innerText()).trim();
        } catch {
          await sleep(800);
          continue;
        }

        if (text && text === lastText) {
          stableCount += 1;
          if (stableCount >= 4) {
            return text;
          }
        } else {
          lastText = text;
          stableCount = 0;
        }

        await sleep(1000);
      }

      throw new Error('Timed out waiting for response');
    },
  };
}
