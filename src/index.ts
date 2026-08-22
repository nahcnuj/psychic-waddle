import { loadConfig } from "./config.ts";
import { createBrowser } from "./core/browser.ts";
import { createChatClient } from "./core/client.ts";
import { runSession } from "./core/session.ts";
import { createConsoleIO } from "./utils/console-io.ts";

async function main() {
  const config = loadConfig();
  const io = createConsoleIO();

  io.write("provider=" + config.provider + " url=" + config.url);
  io.write("headless=" + config.headless + " browser=" + config.browser);

  const { page, close } = await createBrowser(config);
  const client = createChatClient(page, config);

  try {
    await runSession(client, io, {
      responseTimeoutMs: config.responseTimeoutMs,
    });
  } finally {
    await io.close();
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
