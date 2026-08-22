import type { Page } from 'playwright';
import type { AppConfig, ChatClient, ProviderName } from './types.ts';
import { createXGrokClient } from '../providers/x-grok.ts';

type ClientFactory = (page: Page, url: string) => ChatClient;

const CLIENT_FACTORIES: Record<ProviderName, ClientFactory> = {
  'x-grok': createXGrokClient,
  // 増やすときはここに追加（型が不足を検知する）
};

export function createChatClient(page: Page, config: AppConfig): ChatClient {
  return CLIENT_FACTORIES[config.provider](page, config.url);
}
