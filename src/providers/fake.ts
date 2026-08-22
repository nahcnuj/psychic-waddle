import type { ChatClient } from '../core/types.ts';

export function createFakeChatClient(options?: {
  responses?: string[];
  failOnSend?: boolean;
}): ChatClient {
  const responses = [...(options?.responses ?? ['fake response'])];
  let opened = false;

  return {
    name: 'fake',
    url: 'https://example.com',

    async open() {
      opened = true;
    },

    async sendPrompt(_prompt: string) {
      if (!opened) {
        throw new Error('not opened');
      }
      if (options?.failOnSend) {
        throw new Error('send failed');
      }
    },

    async waitForResponse() {
      if (responses.length === 0) {
        return 'no more responses';
      }
      return responses.shift()!;
    },
  };
}
