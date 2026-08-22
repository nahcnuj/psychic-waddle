import fs from "node:fs";
import path from "node:path";
import { chrome } from "./chrome.ts";
import { vivaldi } from "./vivaldi.ts";

export const BROWSERS = {
  chrome,
  vivaldi,
} as const;

export type BrowserKind = keyof typeof BROWSERS;

export function resolveExecutable(kind: BrowserKind): string | undefined {
  for (const p of BROWSERS[kind].executables()) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export function resolveSourceUserDataDir(kind: BrowserKind): string {
  return BROWSERS[kind].userDataDir();
}

export function resolveDefaultUserDataDir(kind: BrowserKind): string {
  return resolveSourceUserDataDir(kind) + "-waddle";
}

function copyFileIfExists(source: string, dest: string): boolean {
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.copyFileSync(source, dest);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[WARN] skip locked/unreadable: " + source + " (" + message + ")");
    return false;
  }
}

/**
 * passwordSource: パスワードの取得元（実行ブラウザと分離可）
 * 例: browser=chrome, passwordSource=vivaldi
 */
export function overlayPasswordData(
  passwordSource: BrowserKind,
  dest: string,
  profileDirectory = "Default",
): void {
  const source = resolveSourceUserDataDir(passwordSource);
  const loginDest = path.join(dest, profileDirectory, "Login Data");

  if (fs.existsSync(loginDest)) {
    console.log("[INFO] Password manager files already present, skip copy");
    return;
  }

  const pairs: Array<[string, string]> = [
    [path.join(source, "Local State"), path.join(dest, "Local State")],
    [
      path.join(source, profileDirectory, "Login Data"),
      path.join(dest, profileDirectory, "Login Data"),
    ],
    [
      path.join(source, profileDirectory, "Login Data-journal"),
      path.join(dest, profileDirectory, "Login Data-journal"),
    ],
  ];

  let copied = 0;
  for (const [from, to] of pairs) {
    if (copyFileIfExists(from, to)) copied += 1;
  }

  if (copied > 0) {
    console.log(
      "[INFO] Overlaid password files from " + passwordSource + " (" + copied + ")",
    );
  } else {
    console.warn("[WARN] Password files not copied from " + passwordSource);
  }
}

export function ensureUserDataDir(
  kind: BrowserKind,
  dest?: string,
  profileDirectory = "Default",
  copyPasswords = true,
  passwordSource?: BrowserKind,
): string {
  const target = dest ?? resolveDefaultUserDataDir(kind);

  if (!fs.existsSync(target)) {
    console.log("[INFO] Creating profile dir: " + target);
    fs.mkdirSync(target, { recursive: true });
  }

  if (copyPasswords) {
    // Chrome 実行時はデフォルトで Vivaldi からパスワードを取る
    const source: BrowserKind =
      passwordSource ?? (kind === "chrome" ? "vivaldi" : kind);
    overlayPasswordData(source, target, profileDirectory);
  } else {
    console.log("[INFO] Skipping password overlay (--no-passwords)");
  }

  return target;
}
