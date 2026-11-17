/** Prepends https:// when user pastes `example.com/foo` style input. */

export function normalizeUrlInput(raw: string): { value: string; fixed: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: '', fixed: false };

  if (/^https?:\/\//i.test(trimmed)) {
    return { value: trimmed, fixed: false };
  }

  // Allow explicit scheme-less hosts and paths
  const looksLikeUrl = /^[\w.-]+\.[a-z]{2,}/i.test(trimmed) || /^[\w.-]+(?:\/|$)/.test(trimmed);
  if (looksLikeUrl) {
    return { value: `https://${trimmed.replace(/^\/+/, '')}`, fixed: true };
  }

  return { value: trimmed, fixed: false };
}

export function normalizeBatchInput(text: string): { lines: string[]; fixedCount: number } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => normalizeUrlInput(l).value);
  const rawCount = text.split('\n').filter((l) => l.trim()).length;
  const fixedCount = lines.filter((l, i) => {
    const raw = text.split('\n').map((x) => x.trim()).filter(Boolean)[i];
    return raw && !/^https?:\/\//i.test(raw) && l.startsWith('https://');
  }).length;
  return { lines, fixedCount };
}