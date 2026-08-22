export type CodeBlock = {
  language: string;
  code: string;
};

const LANG = "powershell|bash|sh|shell|zsh|cmd|bat|python|py|javascript|js|node|typescript|ts";

function looksLikeCodeLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;

  // 日本語 UI
  if (/[\u3040-\u30ff\u4e00-\u9fff]{2,}/.test(t)) return false;
  if (/の使い方$|について$|の比較$|の違い$|ガイド$|対策$|手法$/.test(t)) return false;

  // 英語サジェスト（Title Case の短い句）
  if (/^[A-Z][A-Za-z0-9]*(\s+[A-Z][A-Za-z0-9]*){1,8}$/.test(t) && !/[`$|<>{}()=;]/.test(t)) {
    return false;
  }
  if (
    /^(Explore|Investigate|Analyze|Debug|Refine|Learn|Add|Use|Fix|Include|Review|Provide|Regex|Grok API)\b/i.test(
      t,
    ) &&
    !/[`$|<>{}()=;\\]/.test(t)
  ) {
    return false;
  }

  return true;
}

export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const language = (m[1] ?? "").trim().toLowerCase();
    const code = (m[2] ?? "")
      .split(/\r?\n/)
      .filter(looksLikeCodeLine)
      .join("\n")
      .replace(/\s+$/, "");
    if (code.length > 0) blocks.push({ language, code });
  }
  if (blocks.length > 0) return blocks;

  const unfencedRe = new RegExp(
    "(?:^|\\n)(" +
      LANG +
      ")\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:PowerShell|Python|JavaScript|もっとよく|自動|Explore|関連|キーボード|コードを実行|完了|Command results|Task is not|$))",
    "gi",
  );

  while ((m = unfencedRe.exec(text)) !== null) {
    const language = (m[1] ?? "").trim().toLowerCase();
    const lines = (m[2] ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(looksLikeCodeLine);
    // 先頭の実行可能行だけ（サジェストに食い込まない）
    const code = lines.slice(0, 3).join("\n").trim();
    if (code.length > 0) blocks.push({ language, code });
  }

  return blocks;
}

export function blockKey(block: CodeBlock): string {
  return block.language + "\n" + block.code;
}
