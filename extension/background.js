importScripts('heuristics.js');

const DEFAULT_API = 'http://127.0.0.1:8000';
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getApiBase() {
  const { apiBase } = await chrome.storage.sync.get({ apiBase: DEFAULT_API });
  return (apiBase || DEFAULT_API).replace(/\/$/, '');
}

async function checkUrl(url) {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API ${res.status}`);
  }
  const result = await res.json();
  return {
    ...result,
    displayRisk: result.is_phishing
      ? Math.round(result.confidence * 100)
      : Math.max(0, Math.round((1 - result.confidence) * 30)),
    source: 'model',
  };
}

function heuristicFallback(url) {
  const h = PhishGuardHeuristics.getUrlHeuristicScore(url);
  return {
    url,
    verdict: h.score >= 55 ? 'phishing' : h.score >= 35 ? 'suspicious' : 'benign',
    is_phishing: h.score >= 55,
    confidence: h.score / 100,
    model_name: 'client-heuristics',
    reasons: h.hints,
    riskScore: h.score,
    displayRisk: h.score,
    band: h.band,
    bandLabel: h.label,
    source: 'heuristics',
  };
}

async function getCached(url) {
  const key = `cache:${url}`;
  const data = await chrome.storage.session.get(key);
  const entry = data[key];
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) return null;
  return entry.result;
}

async function setCache(url, result) {
  await chrome.storage.session.set({ [`cache:${url}`]: { at: Date.now(), result } });
}

async function resolveUrl(url, { allowHeuristics = true } = {}) {
  const cached = await getCached(url);
  if (cached) return cached;
  try {
    const result = await checkUrl(url);
    result.band = PhishGuardHeuristics.scoreBand(
      result.is_phishing ? result.confidence * 100 : result.displayRisk ?? 0
    ).band;
    result.bandLabel = PhishGuardHeuristics.scoreBand(
      result.is_phishing ? result.confidence * 100 : result.displayRisk ?? 0
    ).label;
    await setCache(url, result);
    return result;
  } catch {
    if (!allowHeuristics) throw new Error('API unavailable');
    const fallback = heuristicFallback(url);
    await setCache(url, fallback);
    return fallback;
  }
}

function badgeFor(result) {
  if (result.source === 'heuristics' && result.model_name === 'client-heuristics') {
    const pct = result.riskScore ?? 0;
    if (pct >= 55) {
      return { text: '!', color: '#EE0000', title: `Heuristic risk ${pct}%` };
    }
    if (pct >= 35) {
      return { text: '~', color: '#F5A623', title: `Suspicious ${pct}%` };
    }
    return { text: 'OK', color: '#0070F3', title: `Looks OK (${pct}% heuristic)` };
  }
  if (result.is_phishing) {
    return {
      text: '!',
      color: '#EE0000',
      title: `Phishing (${Math.round(result.confidence * 100)}%)`,
    };
  }
  return { text: 'OK', color: '#0070F3', title: `Benign (${Math.round(result.confidence * 100)}%)` };
}

async function scanTab(tabId, url) {
  const settings = await chrome.storage.sync.get({ hoverLinks: true, warnOnClick: false });
  try {
    const result = await resolveUrl(url);
    await chrome.storage.session.set({ [`tab:${tabId}`]: result });
    const badge = badgeFor(result);
    chrome.action.setBadgeText({ tabId, text: badge.text });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
    chrome.action.setTitle({ tabId, title: badge.title });
    chrome.tabs
      .sendMessage(tabId, {
        type: 'PHISHGUARD_RESULT',
        result,
        settings,
      })
      .catch(() => {});
    return result;
  } catch (err) {
    chrome.action.setBadgeText({ tabId, text: '?' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#666666' });
    chrome.action.setTitle({ tabId, title: 'URLSentinel API unavailable' });
    throw err;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url || !tab.url.startsWith('http')) {
    return;
  }
  scanTab(tabId, tab.url).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'phishguard-scan-link',
    title: 'Scan link with URLSentinel',
    contexts: ['link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'phishguard-scan-link' || !info.linkUrl || !tab?.id) return;
  const result = await resolveUrl(info.linkUrl);
  chrome.storage.session.set({ [`context:${tab.id}`]: { url: info.linkUrl, result } });
  chrome.tabs.sendMessage(tab.id, { type: 'PHISHGUARD_TOAST', url: info.linkUrl, result }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PHISHGUARD_CHECK') {
    resolveUrl(msg.url, { allowHeuristics: msg.allowHeuristics !== false })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'PHISHGUARD_GET_SETTINGS') {
    chrome.storage.sync
      .get({
        apiBase: DEFAULT_API,
        hoverLinks: true,
        warnOnClick: false,
      })
      .then((s) => sendResponse({ ok: true, settings: s }));
    return true;
  }
  if (msg.type === 'PHISHGUARD_SAVE_SETTINGS') {
    const patch = { ...msg.settings };
    if (!Object.prototype.hasOwnProperty.call(patch, 'apiBase')) {
      patch.apiBase = DEFAULT_API;
    }
    chrome.storage.sync.set(patch).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'PHISHGUARD_AUDIT_BATCH') {
    (async () => {
      const items = msg.items || [];
      const results = [];
      for (const item of items.slice(0, 40)) {
        try {
          const result = await resolveUrl(item.url);
          results.push({ label: item.label, ...result });
        } catch (e) {
          results.push({ label: item.label, url: item.url, error: String(e) });
        }
      }
      results.sort((a, b) => {
        const ar = a.is_phishing ? (a.confidence || 0) : 0;
        const br = b.is_phishing ? (b.confidence || 0) : 0;
        return br - ar;
      });
      sendResponse({ ok: true, results });
    })();
    return true;
  }
});