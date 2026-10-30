const API_BASE = 'http://127.0.0.1:8000';

async function checkUrl(url) {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json();
}

function badgeFor(result) {
  if (result.is_phishing) {
    return { text: '!', color: '#EE0000', title: `Phishing (${Math.round(result.confidence * 100)}%)` };
  }
  return { text: 'OK', color: '#0070F3', title: `Benign (${Math.round(result.confidence * 100)}%)` };
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url || !tab.url.startsWith('http')) {
    return;
  }
  try {
    const result = await checkUrl(tab.url);
    await chrome.storage.session.set({ [`tab:${tabId}`]: result });
    const badge = badgeFor(result);
    chrome.action.setBadgeText({ tabId, text: badge.text });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
    chrome.action.setTitle({ tabId, title: badge.title });
    chrome.tabs.sendMessage(tabId, { type: 'PHISHGUARD_RESULT', result }).catch(() => {});
  } catch (err) {
    chrome.action.setBadgeText({ tabId, text: '?' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#666666' });
    chrome.action.setTitle({ tabId, title: 'PhishGuard API unavailable' });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PHISHGUARD_CHECK') {
    checkUrl(msg.url)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});
