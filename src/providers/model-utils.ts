/** モデル候補ラベルのフィルタ（DOM から取った生文字列用） */
const JUNK_RE =
  /投稿|ポスト|ログイン|設定|検索|アップグレード|Premium|Limit|質問|github\.com|シンキング結果|シンキングしました|コードなし|継続要求|応答待ち/i;

const ACTION_CHIP_RE =
  /^(Explore|Investigate|Explain|Fix|Add|Commit|Learn|Check|Return|Provide|Refactor|Use|Introduce|Suggest|Remove|Run|Discuss|Create|Update|Implement|Enable|Disable|Review|Analyze|Compare|Write|Read|Open|Close|Install|Configure|Setup|Build|Test|Automate)\b/i;

const KNOWN_MODEL_RE =
  /^(auto|fast|expert|heavy|fun|thinking|grok(\s*[-_.]?\s*\d+(\.\d+)?)?|自動|高速|エキスパート)$/i;

function isLikelyModelLabel(t: string): boolean {
  if (KNOWN_MODEL_RE.test(t)) return true;
  if (/grok/i.test(t) && t.length <= 48) return true;
  if (/シンキングする/.test(t) && !/シンキングしました|シンキング結果/.test(t)) {
    return true;
  }
  if (JUNK_RE.test(t) || ACTION_CHIP_RE.test(t)) return false;
  if (/[.!?\/:]/.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return false;
  return t.length >= 2 && t.length <= 24;
}

export function filterModelLabels(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawItem of raw) {
    const t = rawItem.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (t.length < 2 || t.length > 48) continue;
    if (!isLikelyModelLabel(t)) continue;
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