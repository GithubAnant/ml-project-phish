async function init() {
  const status = document.getElementById('status');
  const verdictEl = document.getElementById('verdict');
  const reasonsEl = document.getElementById('reasons');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    status.textContent = 'No active tab URL.';
    return;
  }
  status.textContent = tab.url;

  chrome.runtime.sendMessage({ type: 'PHISHGUARD_CHECK', url: tab.url }, (resp) => {
    if (!resp?.ok) {
      verdictEl.textContent = 'API unavailable';
      verdictEl.className = 'verdict warn';
      return;
    }
    const r = resp.result;
    verdictEl.textContent = r.is_phishing
      ? `Phishing (${Math.round(r.confidence * 100)}%)`
      : `Benign (${Math.round(r.confidence * 100)}%)`;
    verdictEl.className = r.is_phishing ? 'verdict bad' : 'verdict good';
    reasonsEl.innerHTML = '';
    (r.reasons || []).forEach((reason) => {
      const li = document.createElement('li');
      li.textContent = reason;
      reasonsEl.appendChild(li);
    });
  });
}

init();
