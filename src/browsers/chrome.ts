import path from "node:path";
import process from "node:process";

const local = () => process.env.LOCALAPPDATA ?? "";

export const chrome = {
  name: "chrome" as const,
  userDataDir: () => path.join(local(), "Google", "Chrome", "User Data"),
  executables: () => [
    path.join(local(), "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ],
};
