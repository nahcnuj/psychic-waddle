import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ChatClient } from './types.js';
import { logger } from '../utils/logger.js';

export async function runSession(client: ChatClient, responseTimeoutMs: number): Promise<void> {
  const rl = readline.createInterface({ input, output });

  await client.open();

  console.log('========================================');
  console.log(Provider: );
  console.log(URL: );
  console.log('ブラウザでログインし、Grokが使える状態にしてください。');
  console.log('準備ができたら Enter を押してください。');
  console.log('終了するには exit または quit と入力してください。');
  console.log('========================================\n');

  await rl.question('');

  console.log('\nループを開始します。\n');

  while (true) {
    const prompt = (await rl.question('あなた > ')).trim();
    if (!prompt) continue;
    if (['exit', 'quit'].includes(prompt.toLowerCase())) break;

    try {
      logger.info('送信中...');
      await client.sendPrompt(prompt);

      logger.info('応答待ち...');
      const response = await client.waitForResponse(responseTimeoutMs);

      logger.response(response);
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
    }
  }

  await rl.close();
  console.log('セッションを終了しました。');
}
