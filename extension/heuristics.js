/** Client-side URL signals when API is down or for instant hover hints. */

const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'top', 'xyz', 'cam', 'work', 'click', 'link', 'gq', 'tk', 'ml', 'cf', 'ga', 'rest', 'monster', 'sbs',
]);

const BRAND_TOKENS = [
  { brand: 'paypal', pattern: /paypa[1l]|paypa1|pay-pal/i },
  { brand: 'google', pattern: /goo[g0]{2}le|g00gle/i },
  { brand: 'apple', pattern: /app1e|appl[e3]/i },
  { brand: 'microsoft', pattern: /microso[f5]t|rnicrosoft/i },
  { brand: 'amazon', pattern: /amaz0n|arnazon/i },
  { brand: 'facebook', pattern: /faceb[o0]{2}k/i },
  { brand: 'netflix', pattern: /netf1ix/i },
];

function scoreBand(score) {
  if (score >= 75) return { band: 'critical', label: 'Critical risk' };
  if (score >= 55) return { band: 'high', label: 'High risk' };
  if (score >= 35) return { band: 'medium', label: 'Medium risk' };
  if (score >= 15) return { band: 'low', label: 'Low risk' };
  return { band: 'minimal', label: 'Minimal risk' };
}

function getUrlHeuristicScore(url) {
  const hints = [];
  let score = 0;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const full = url.toLowerCase();

    if (parsed.protocol !== 'https:') {
      score += 12;
      hints.push('Not HTTPS');
    }
    if (url.includes('@') || parsed.username) {
      score += 25;
      hints.push('URL contains @ / userinfo');
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      score += 22;
      hints.push('IP address host');
    }
    if (host.startsWith('xn--') || host.includes('xn--')) {
      score += 18;
      hints.push('Punycode / IDN hostname');
    }

    const parts = host.split('.');
    if (parts.length >= 5) {
      score += 10;
      hints.push('Many subdomains');
    }

    const tld = parts[parts.length - 1];
    if (SUSPICIOUS_TLDS.has(tld)) {
      score += 15;
      hints.push(`Suspicious TLD .${tld}`);
    }

    for (const { brand, pattern } of BRAND_TOKENS) {
      if (pattern.test(full) && !host.endsWith(`${brand}.com`)) {
        score += 20;
        hints.push(`Possible ${brand} typosquat`);
        break;
      }
    }

    if (/login|verify|secure|account|password|signin|update/.test(full)) {
      score += 8;
      hints.push('Sensitive keywords in URL');
    }
  } catch {
    return { score: 0, band: scoreBand(0), hints: ['Invalid URL'] };
  }

  score = Math.min(100, score);
  return { score, ...scoreBand(score), hints: hints.slice(0, 4) };
}

// MV3 service worker + content script
const g = typeof globalThis !== 'undefined' ? globalThis : self;
g.PhishGuardHeuristics = { getUrlHeuristicScore, scoreBand };