export const logger = {
  info: (msg: string) => console.log([INFO] ),
  warn: (msg: string) => console.warn([WARN] ),
  error: (msg: string) => console.error([ERROR] ),
  prompt: (msg: string) => console.log(\nあなた > ),
  response: (msg: string) => {
    console.log('\nGrok >');
    console.log(msg);
    console.log('');
  },
};
