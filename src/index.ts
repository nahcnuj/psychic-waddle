import { loadConfig } from './config.js';
import { createBrowser } from './core/browser.js';
import { createChatClient } from './core/client.js';
import { runSession } from './core/session.js';
import { createConsoleIO } from './utils/console-io.js';

async function main() {
  const config = loadConfig();
  const io = createConsoleIO();

  io.write('provider=' + config.provider + ' url=' + config.url);

  const { browser, page } = await createBrowser(config);
  const client = createChatClient(page, config);

  try {
    await runSession(client, io, {
      responseTimeoutMs: config.responseTimeoutMs,
    });
  } finally {
    await io.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
