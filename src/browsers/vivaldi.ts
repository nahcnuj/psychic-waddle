import path from "node:path";
import process from "node:process";

const local = () => process.env.LOCALAPPDATA ?? "";

export const vivaldi = {
  name: "vivaldi" as const,
  userDataDir: () => path.join(local(), "Vivaldi", "User Data"),
  executables: () => [
    path.join(local(), "Vivaldi", "Application", "vivaldi.exe"),
    "C:\\Program Files\\Vivaldi\\Application\\vivaldi.exe",
  ],
};
