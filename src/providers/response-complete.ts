export function hasUnclosedCodeFence(text: string): boolean { return ((text.match(new RegExp('```', 'g')) ?? []).length % 2) === 1; }
export function hasCodeFence(text: string): boolean { return new RegExp('```' + '[\\s\\S]*?' + '```').test(text); }
export function isIntermediateResponse(text: string): boolean { if (hasUnclosedCodeFence(text)) return true; if (/thinking about your request/i.test(text)) return true; if (/\bThinking\.\.\./i.test(text)) return true; if (/回答を生成中/.test(text)) return true; if (/考えています/.test(text)) return true; if (/Generating( a)? response/i.test(text)) return true; return false; }
export type CompletionSignals = { text: string; textBeforeSend: string; stopControlVisible: boolean; composerEnabled: boolean; generatingIndicatorVisible: boolean };
export function isOutputComplete(s: CompletionSignals): boolean { if (!s.text || s.text === s.textBeforeSend) return false; if (isIntermediateResponse(s.text)) return false; if (hasUnclosedCodeFence(s.text)) return false; if (s.stopControlVisible) return false; if (s.generatingIndicatorVisible) return false; if (!s.composerEnabled) return false; return true; }

