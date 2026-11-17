export type UrlHint = { level: 'warn' | 'info'; text: string };

const SUSPICIOUS_TLDS = new Set([
  'zip',
  'mov',
  'top',
  'xyz',
  'cam',
  'work',
  'click',
  'link',
  'gq',
  'tk',
  'ml',
  'cf',
  'ga',
  'rest',
  'monster',
  'sbs',
]);

export function getUrlHints(raw: string): UrlHint[] {
  const url = raw.trim();
  if (url.length < 4) return [];

  const hints: UrlHint[] = [];

  let toParse = url;
  if (!/^https?:\/\//i.test(url) && /^[\w.-]+\.[a-z]{2,}/i.test(url)) {
    toParse = `https://${url}`;
  }

  try {
    const parsed = new URL(toParse);
    if (parsed.protocol !== 'https:') {
      hints.push({ level: 'warn', text: 'Not HTTPS — banks and big brands usually force TLS.' });
    }
    if (parsed.username || parsed.password || url.includes('@')) {
      hints.push({ level: 'warn', text: 'Contains `@` / userinfo — can hide the real host.' });
    }
    const host = parsed.hostname;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      hints.push({ level: 'warn', text: 'Host is an IP address, not a domain name.' });
    }
  } catch {
    hints.push({ level: 'info', text: 'Finish typing a full URL (include https://).' });
    return hints;
  }

  if (url.split('/').length > 5) {
    hints.push({ level: 'info', text: 'Long path — common in redirect chains.' });
  }
  const tldMatch = url.match(/\.([a-z]{2,24})(?:[/:?]|$)/i);
  if (tldMatch && SUSPICIOUS_TLDS.has(tldMatch[1].toLowerCase())) {
    hints.push({ level: 'warn', text: `TLD ".${tldMatch[1]}" is often abused in campaigns.` });
  }
  const lower = url.toLowerCase();
  if (/login|verify|secure|account|update|password/.test(lower)) {
    hints.push({ level: 'info', text: 'Sensitive-action keywords in URL (login / verify / account).' });
  }

  return hints.slice(0, 4);
}