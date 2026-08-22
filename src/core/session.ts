import type { ChatClient, SessionIO } from './types.js';

export type SessionOptions = {
  responseTimeoutMs: number;
};

export async function runSession(
  client: ChatClient,
  io: SessionIO,
  options: SessionOptions
): Promise<void> {
  await client.open();

  io.write('========================================');
  io.write('Provider: ' + client.name);
  io.write('URL: ' + client.url);
  io.write('ブラウザでログインし、Grokが使える状態にしてください。');
  io.write('準備ができたら Enter を押してください。');
  io.write('終了するには exit または quit と入力してください。');
  io.write('========================================');

  await io.read('');

  io.write('');
  io.write('ループを開始します。');
  io.write('');

  while (true) {
    const prompt = (await io.read('あなた > ')).trim();
    if (!prompt) {
      continue;
    }
    if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
      break;
    }

    try {
      io.write('送信中...');
      await client.sendPrompt(prompt);

      io.write('応答待ち...');
      const response = await client.waitForResponse(options.responseTimeoutMs);

      io.write('');
      io.write('Grok >');
      io.write(response);
      io.write('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      io.write('[ERROR] ' + message);
    }
  }

  io.write('セッションを終了しました。');
}
