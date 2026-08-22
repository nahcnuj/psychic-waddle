import type { AppConfig, ProviderName } from "./core/types.ts";
import type { BrowserKind } from "./browsers/index.ts";
import { BROWSERS, resolveDefaultUserDataDir } from "./browsers/index.ts";
import process from "node:process";

const PROVIDERS: Record<ProviderName, { url: string }> = {
  "x-grok": {
    url: "https://x.com/i/grok",
  },
};

export function loadConfig(argv: string[] = process.argv.slice(2)): AppConfig {
  const hasFlag = (name: string): boolean => argv.includes(name);

  const getArg = (name: string): string | undefined => {
    const idx = argv.findIndex((a) => a === name);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };

  const provider = (getArg("--provider") ?? "x-grok") as ProviderName;
  const meta = PROVIDERS[provider];
  const browser = (getArg("--browser") ?? "vivaldi") as BrowserKind;

  if (!(browser in BROWSERS)) {
    throw new Error(
      "Unknown browser: " + browser + ". Available: " + Object.keys(BROWSERS).join(", ")
    );
  }

  return {
    provider,
    url: getArg("--url") ?? meta.url,
    headless: hasFlag("--headless"),
    cdpUrl: getArg("--cdp"),
    responseTimeoutMs: Number(getArg("--timeout") ?? 90000),
    browser,
    userDataDir: getArg("--user-data-dir") ?? resolveDefaultUserDataDir(browser),
    profileDirectory: getArg("--profile-directory") ?? "Default",
  };
}
