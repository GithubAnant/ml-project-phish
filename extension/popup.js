function normalizeUrl(raw) {
  const t = (raw || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(t) || t.includes('/')) return `https://${t}`;
  return t;
}

function setRiskUI(result) {
  const wrap = document.getElementById('risk-bar-wrap');
  const fill = document.getElementById('risk-fill');
  const pctEl = document.getElementById('risk-pct');
  const bandEl = document.getElementById('band-label');

  if (!result) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');
  const pct =
    result.source === 'heuristics'
      ? result.riskScore ?? 0
      : result.is_phishing
        ? Math.round(result.confidence * 100)
        : Math.max(0, Math.round((1 - result.confidence) * 30));
  pctEl.textContent = `${pct}%`;
  const malicious = result.is_phishing || (result.source === 'heuristics' && (result.riskScore ?? 0) >= 55);
  const suspicious = !malicious && (result.verdict === 'suspicious' || (result.riskScore ?? 0) >= 35);
  bandEl.textContent = malicious ? 'Likely malicious' : suspicious ? 'Suspicious' : 'Likely safe';
  fill.style.width = `${Math.min(100, pct)}%`;
  fill.className = 'risk-fill';
  if (malicious) fill.classList.add('risk-fill--bad');
  else if (suspicious) fill.classList.add('risk-fill--warn');
  else fill.classList.add('risk-fill--ok');
}

function renderResult(r) {
  const verdictEl = document.getElementById('verdict');
  const reasonsEl = document.getElementById('reasons');
  const targetEl = document.getElementById('target');
  setRiskUI(r);

  const conf = Math.round((r.confidence || 0) * 100);
  const malicious = r.is_phishing;

  if (malicious) {
    verdictEl.textContent = `Malicious · ${conf}% confidence`;
    verdictEl.className = 'verdict bad';
  } else if (r.verdict === 'suspicious' || (r.source === 'heuristics' && (r.riskScore ?? 0) >= 35)) {
    verdictEl.textContent = `Suspicious · review before opening`;
    verdictEl.className = 'verdict warn';
  } else {
    verdictEl.textContent = `Likely safe · ${conf}% benign`;
    verdictEl.className = 'verdict good';
  }

  if (r.url) {
    targetEl.textContent = r.url;
    targetEl.classList.remove('hidden');
  }

  reasonsEl.innerHTML = '';
  (r.reasons || []).forEach((reason) => {
    const li = document.createElement('li');
    li.textContent = reason;
    reasonsEl.appendChild(li);
  });
}

function scanUrl(url) {
  const verdictEl = document.getElementById('verdict');
  const reasonsEl = document.getElementById('reasons');
  const btn = document.getElementById('scan-btn');
  verdictEl.textContent = 'Scanning…';
  verdictEl.className = 'verdict';
  reasonsEl.innerHTML = '';
  setRiskUI(null);
  btn.disabled = true;

  chrome.runtime.sendMessage({ type: 'PHISHGUARD_CHECK', url }, (resp) => {
    btn.disabled = false;
    if (!resp?.ok) {
      verdictEl.textContent = 'Could not scan';
      verdictEl.className = 'verdict warn';
      reasonsEl.innerHTML = `<li>${resp?.error || 'Unknown error'}</li>`;
      return;
    }
    renderResult(resp.result);
  });
}

function saveToggles() {
  chrome.runtime.sendMessage({
    type: 'PHISHGUARD_SAVE_SETTINGS',
    settings: {
      hoverLinks: document.getElementById('hover-links').checked,
      warnOnClick: document.getElementById('warn-click').checked,
    },
  });
}

function loadToggles() {
  chrome.runtime.sendMessage({ type: 'PHISHGUARD_GET_SETTINGS' }, (resp) => {
    const s = resp?.settings || {};
    document.getElementById('hover-links').checked = s.hoverLinks !== false;
    document.getElementById('warn-click').checked = !!s.warnOnClick;
  });
}

async function init() {
  const input = document.getElementById('url-input');
  const form = document.getElementById('scan-form');
  let activeTab = null;

  loadToggles();
  input.focus();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;

  document.getElementById('hover-links').addEventListener('change', saveToggles);
  document.getElementById('warn-click').addEventListener('change', saveToggles);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = normalizeUrl(input.value);
    if (!url) return;
    input.value = url;
    scanUrl(url);
  });

  document.getElementById('use-tab').addEventListener('click', () => {
    if (!activeTab?.url || !activeTab.url.startsWith('http')) {
      document.getElementById('verdict').textContent = 'Open a normal webpage first.';
      document.getElementById('verdict').className = 'verdict warn';
      return;
    }
    input.value = activeTab.url;
    scanUrl(activeTab.url);
  });

  document.getElementById('audit-page').addEventListener('click', () => {
    if (!activeTab?.id) return;
    const btn = document.getElementById('audit-page');
    btn.textContent = 'Scanning…';
    chrome.tabs.sendMessage(activeTab.id, { type: 'PHISHGUARD_AUDIT_PAGE', limit: 35 }, (resp) => {
      btn.textContent = 'Audit this page';
      if (!resp?.ok) {
        document.getElementById('verdict').textContent = 'Could not audit — try a regular page.';
        document.getElementById('verdict').className = 'verdict warn';
      }
    });
  });
}

init();