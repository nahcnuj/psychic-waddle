/** モデル候補ラベルのフィルタ（DOM から取った生文字列用） */
export function filterModelLabels(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawItem of raw) {
    const t = rawItem.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length < 2 || t.length > 48) continue;
    if (/投稿|ポスト|ログイン|設定|検索|アップグレード|Premium|Limit|質問/i.test(t)) {
      continue;
    }
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function isRateLimited(text: string): boolean {
  return (
    /reached your limit/i.test(text) ||
    /limit of \d+ Grok/i.test(text) ||
    /プレミアムプラス/.test(text) ||
    /アップグレードして会話を続ける/.test(text) ||
    /check back later/i.test(text)
  );
}
