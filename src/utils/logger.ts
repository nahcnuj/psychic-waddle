export const logger = {
  info: (msg: string) => console.log('[INFO] ' + msg),
  warn: (msg: string) => console.warn('[WARN] ' + msg),
  error: (msg: string) => console.error('[ERROR] ' + msg),
  response: (msg: string) => {
    console.log('');
    console.log('Grok >');
    console.log(msg);
    console.log('');
  },
};
