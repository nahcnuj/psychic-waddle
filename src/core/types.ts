export type ProviderName = 'x-grok'; // 増やすときはここに追加

export interface AppConfig {
  provider: ProviderName;
  url: string;
  headless: boolean;
  cdpUrl?: string;
  responseTimeoutMs: number;
}

export interface ChatClient {
  readonly name: string;
  readonly url: string;

  /** 指定URLを開く */
  open(): Promise<void>;

  /** プロンプトを送信する */
  sendPrompt(prompt: string): Promise<void>;

  /** 応答が安定するまで待ってテキストを返す */
  waitForResponse(timeoutMs?: number): Promise<string>;

  /** 新しいチャットを開始する（任意） */
  newChat?(): Promise<void>;

  /** 現在の会話履歴を取得する（任意） */
  getHistory?(): Promise<string[]>;
}
