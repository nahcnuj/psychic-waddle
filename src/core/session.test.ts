import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSession } from './session.ts';
import { createFakeChatClient } from '../providers/fake.ts';
import type { SessionIO } from './types.ts';

function createScriptedIO(answers: string[]): SessionIO & { outputs: string[] } {
  const queue = [...answers];
  const outputs: string[] = [];

  return {
    outputs,
    async read(_prompt: string) {
      if (queue.length === 0) {
        return 'exit';
      }
      return queue.shift()!;
    },
    write(message: string) {
      outputs.push(message);
    },
  };
}

describe('runSession', () => {
  it('opens client, sends prompts, and exits on exit', async () => {
    const sent: string[] = [];
    const client = createFakeChatClient({
      responses: ['hello back', 'second reply'],
    });

    const originalSend = client.sendPrompt.bind(client);
    client.sendPrompt = async (prompt: string) => {
      sent.push(prompt);
      await originalSend(prompt);
    };

    const io = createScriptedIO(['', 'hello', 'second', 'exit']);
    await runSession(client, io, { responseTimeoutMs: 1000 });

    assert.deepEqual(sent, ['hello', 'second']);
    assert.ok(io.outputs.some((line) => line.includes('hello back')));
    assert.ok(io.outputs.some((line) => line.includes('second reply')));
  });

  it('continues after send error', async () => {
    let calls = 0;
    const client = createFakeChatClient();
    client.sendPrompt = async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('send failed');
      }
    };
    client.waitForResponse = async () => 'ok';

    const io = createScriptedIO(['', 'first', 'second', 'exit']);
    await runSession(client, io, { responseTimeoutMs: 1000 });

    assert.equal(calls, 2);
    assert.ok(io.outputs.some((line) => line.includes('send failed')));
    assert.ok(io.outputs.some((line) => line.includes('ok')));
  });
});
