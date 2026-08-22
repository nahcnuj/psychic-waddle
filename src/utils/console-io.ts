import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";

export type ConsoleIO = {
  read: (prompt: string) => Promise<string>;
  write: (message: string) => void;
  close: () => Promise<void>;
};

/**
 * 複数行を stdin から読み、EOF までを1メッセージとする。
 * Windows では EOF は Ctrl+Z のあと Enter。
 */
export function createConsoleIO(): ConsoleIO {
  return {
    async read(prompt: string): Promise<string> {
      output.write(prompt);

      const rl = readline.createInterface({ input, output, terminal: true });
      const lines: string[] = [];

      const text = await new Promise<string>((resolve) => {
        rl.on("line", (line) => {
          lines.push(line);
        });
        // stdin が EOF になると Interface が close する
        rl.on("close", () => {
          resolve(lines.join("\n"));
        });
      });

      return text.replace(/\s+$/, "");
    },

    write(message: string) {
      console.log(message);
    },

    async close() {
      // read のたびに Interface は close 済み
    },
  };
}
