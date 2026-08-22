import { loadConfig } from './config.js';
import { createBrowser } from './core/browser.js';
import { createChatClient } from './core/client.js';
import { runSession } from './core/session.js';
import { logger } from './utils/logger.js';

async function main() {
  const config = loadConfig();

  logger.info(provider= url=);

  const { browser, page } = await createBrowser(config);
  const client = createChatClient(page, config);

  try {
    await runSession(client, config.responseTimeoutMs);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
