import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasUnclosedCodeFence, isIntermediateResponse, isOutputComplete } from './response-complete.ts';
describe('response-complete', () => {
  it('odd fence incomplete', () => { assert.equal(hasUnclosedCodeFence('```ps
hi'), true); });
  it('thinking is intermediate', () => { assert.equal(isIntermediateResponse('Thinking...'), true); });
  it('idle ui required', () => { const base = { text: 'final', textBeforeSend: 'old', stopControlVisible: false, composerEnabled: true, generatingIndicatorVisible: false }; assert.equal(isOutputComplete(base), true); assert.equal(isOutputComplete({ ...base, stopControlVisible: true }), false); });
});

