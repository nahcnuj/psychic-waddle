import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { AppConfig } from './types.js';
import { logger } from '../utils/logger.js';

export async function createBrowser(config: AppConfig): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  let browser: Browser;

  if (config.cdpUrl) {
    logger.info(CDP接続: );
    browser = await chromium.connectOverCDP(config.cdpUrl);
  } else {
    logger.info('ブラウザを起動します');
    browser = await chromium.launch({
      headless: config.headless,
    });
  }

  const context = browser.contexts()[0] ?? await browser.newContext();
  const page = context.pages()[0] ?? await context.newPage();

  return { browser, context, page };
}
