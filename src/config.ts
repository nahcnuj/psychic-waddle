import type { AppConfig, GrokSite } from './grok/types.js';

function resolveSite(value?: string): { site: GrokSite; url: string } {
  const v = (value ?? 'x').toLowerCase();

  if (v === 'grok' || v === 'grok.com') {
    return { site: 'grok.com', url: 'https://grok.com' };
  }
  if (v === 'x' || v === 'x.com' || v === 'twitter') {
    return { site: 'x.com', url: 'https://x.com/i/grok' };
  }
  if (v.startsWith('http')) {
    const site: GrokSite = v.includes('grok.com') ? 'grok.com' : 'x.com';
    return { site, url: v };
  }

  // default
  return { site: 'x.com', url: 'https://x.com/i/grok' };
}

export function loadConfig(argv: string[] = process.argv.slice(2)): AppConfig {
  const getArg = (name: string): string | undefined => {
    const idx = argv.findIndex(a => a === name || a === `-`);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };

  const hasFlag = (name: string): boolean => argv.includes(name);

  const { site, url } = resolveSite(getArg('--url') ?? getArg('-u'));

  return {
    site,
    url,
    headless: hasFlag('--headless'),
    cdpUrl: getArg('--cdp'),
    responseTimeoutMs: Number(getArg('--timeout') ?? 90000),
  };
}
