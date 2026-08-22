import type { BrowserKind } from "../browsers/index.ts";

export type ProviderName = "x-grok";

export interface AppConfig {
  provider: ProviderName;
  url: string;
  headless: boolean;
  cdpUrl?: string;
  responseTimeoutMs: number;
  browser: BrowserKind;
  userDataDir?: string;
  profileDirectory: string;
}

export interface ChatClient {
  readonly name: string;
  readonly url: string;
  open(): Promise<void>;
  sendPrompt(prompt: string): Promise<void>;
  waitForResponse(timeoutMs?: number): Promise<string>;
  newChat?(): Promise<void>;
  getHistory?(): Promise<string[]>;
}

export type SessionIO = {
  read: (prompt: string) => Promise<string>;
  write: (message: string) => void;
};
