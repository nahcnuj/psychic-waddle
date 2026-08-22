import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { SessionIO } from '../core/types.js';

export function createConsoleIO(): SessionIO & { close: () => Promise<void> } {
  const rl = readline.createInterface({ input, output });

  return {
    read: (prompt: string) => rl.question(prompt),
    write: (message: string) => {
      console.log(message);
    },
    close: async () => {
      rl.close();
    },
  };
}
