const TOOLTIP_ID = 'phishguard-hover-tip';
let hoverTimer = null;
let pageTabResult = null;
let settings = { hoverLinks: true, warnOnClick: false };

function ensureTooltip() {
  let el = document.getElementById(TOOLTIP_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = TOOLTIP_ID;
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed',
    'z-index:2147483646',
    'max-width:320px',
    'padding:10px 12px',
    'border-radius:8px',
    'border:1px solid #333',
    'background:#0a0a0a',
    'color:#ededed',
    'font:12px/1.45 system-ui,sans-serif',
    'box-shadow:0 8px 30px rgba(0,0,0,0.5)',
    'pointer-events:none',
    'display:none',
  ].join(';');
  document.documentElement.appendChild(el);
  return el;
}

function showTooltip(x, y, html) {
  const el = ensureTooltip();
  el.innerHTML = html;
  el.style.left = `${Math.min(x, window.innerWidth - 330)}px`;
  el.style.top = `${Math.min(y + 14, window.innerHeight - 120)}px`;
  el.style.display = 'block';
}

function hideTooltip() {
  const el = document.getElementById(TOOLTIP_ID);
  if (el) el.style.display = 'none';
}

function tooltipHtml(result) {
  const pct =
    result.source === 'heuristics'
      ? result.riskScore
      : result.is_phishing
        ? Math.round(result.confidence * 100)
        : Math.round((1 - result.confidence) * 30);
  const band = result.bandLabel || (result.is_phishing ? 'Phishing' : 'Benign');
  const src = result.source === 'heuristics' ? ' · heuristics' : ` · ${result.model_name || 'model'}`;
  const reasons = (result.reasons || []).slice(0, 2).map((r) => `• ${r}`).join('<br/>');
  const color = result.is_phishing || pct >= 55 ? '#ee0000' : pct >= 35 ? '#f5a623' : '#50e3c2';
  return `<strong style="color:${color}">${band} (${pct}%)</strong>${src}<br/><span style="color:#888">${reasons || 'No extra signals'}</span>`;
}

function highlightLinks(isPhishing) {
  if (!isPhishing) {
    document.querySelectorAll('a[data-phishguard-highlight]').forEach((a) => {
      a.style.outline = '';
      a.removeAttribute('data-phishguard-highlight');
    });
    return;
  }
  document.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('data-phishguard-highlight', '1');
    a.style.outline = '2px dashed #EE0000';
    a.style.outlineOffset = '2px';
  });
}

function showToast(url, result) {
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:360px;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#111;color:#ededed;font:13px system-ui;box-shadow:0 8px 40px rgba(0,0,0,.55)';
  toast.innerHTML = `<strong>URLSentinel</strong><br/><span style="color:#888;word-break:break-all;font-size:11px">${url}</span><br/>${tooltipHtml(result)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function linkUrlFromAnchor(a) {
  try {
    const href = a.href;
    if (!href || !href.startsWith('http')) return null;
    return href;
  } catch {
    return null;
  }
}

function attachHoverScan() {
  document.addEventListener(
    'mouseover',
    (e) => {
      if (!settings.hoverLinks) return;
      const a = e.target.closest?.('a[href]');
      if (!a) return;
      const url = linkUrlFromAnchor(a);
      if (!url) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'PHISHGUARD_CHECK', url }, (resp) => {
          if (!resp?.ok) return;
          showTooltip(e.clientX, e.clientY, tooltipHtml(resp.result));
        });
      }, 350);
    },
    true
  );
  document.addEventListener(
    'mouseout',
    (e) => {
      const a = e.target.closest?.('a[href]');
      if (a) {
        clearTimeout(hoverTimer);
        hideTooltip();
      }
    },
    true
  );

  document.addEventListener(
    'click',
    (e) => {
      if (!settings.warnOnClick) return;
      const a = e.target.closest?.('a[href]');
      if (!a) return;
      const url = linkUrlFromAnchor(a);
      if (!url) return;
      chrome.runtime.sendMessage({ type: 'PHISHGUARD_CHECK', url }, (resp) => {
        if (!resp?.ok) return;
        const r = resp.result;
        const risky = r.is_phishing || (r.riskScore != null && r.riskScore >= 55);
        if (!risky) return;
        const ok = window.confirm(
          `URLSentinel: this link looks risky (${Math.round((r.confidence || r.riskScore / 100) * 100)}%).\n\n${url}\n\nContinue anyway?`
        );
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    },
    true
  );
}

const URL_IN_STRING = /https?:\/\/[^\s'";)]+/gi;

function collectPageLinks(limit = 40) {
  const map = new Map();
  const add = (url, label) => {
    if (!url || typeof url !== 'string') return;
    let absolute = url;
    try {
      absolute = new URL(url, location.href).href;
    } catch {
      return;
    }
    if (!absolute.startsWith('http')) return;
    if (!map.has(absolute)) map.set(absolute, label || 'link');
  };

  document.querySelectorAll('a[href]').forEach((a) => {
    add(a.href, (a.innerText || a.getAttribute('aria-label') || 'anchor').trim().slice(0, 48));
  });
  document.querySelectorAll('button[formaction], input[formaction]').forEach((el) => {
    add(el.getAttribute('formaction'), 'button formaction');
  });
  document.querySelectorAll('form[action]').forEach((f) => add(f.getAttribute('action'), 'form submit'));
  document.querySelectorAll('[data-url], [data-href], [data-link]').forEach((el) => {
    add(
      el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-link'),
      'data-attribute'
    );
  });
  document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]').forEach((btn) => {
    const oc = btn.getAttribute('onclick');
    if (oc) {
      const m = oc.match(URL_IN_STRING);
      if (m) m.forEach((u) => add(u, 'button script'));
    }
    const parentForm = btn.closest('form');
    if (parentForm?.action) add(parentForm.action, 'button → form');
  });

  return [...map.entries()].slice(0, limit).map(([url, label]) => ({ url, label }));
}

function showAuditPanel(results) {
  let panel = document.getElementById('phishguard-audit-panel');
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'phishguard-audit-panel';
    panel.setAttribute('aria-label', 'URLSentinel link audit');
    panel.style.cssText =
      'position:fixed;top:72px;right:16px;z-index:2147483645;width:min(360px,calc(100vw - 32px));max-height:70vh;overflow:auto;padding:14px 16px;background:#000;color:#ededed;font:12px/1.45 system-ui,sans-serif;border:1px solid #333;box-shadow:0 12px 40px rgba(0,0,0,.6);border-radius:10px';
    document.documentElement.appendChild(panel);
  }
  const risky = results.filter((r) => r.is_phishing || (r.riskScore != null && r.riskScore >= 55));
  const rows = results
    .slice(0, 20)
    .map((r) => {
      const pct = r.is_phishing ? Math.round((r.confidence || 0) * 100) : r.riskScore || 0;
      const color = r.is_phishing || pct >= 55 ? '#e00' : '#888';
      return `<li style="margin:8px 0;word-break:break-all"><span style="color:${color}">${pct}%</span> · ${escapeHtml(r.label || '')}<br/><span style="color:#666;font-size:11px">${escapeHtml(r.url || '')}</span></li>`;
    })
    .join('');
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Link audit</strong><button id="pg-audit-close" style="border:none;background:#222;color:#fff;border-radius:4px;padding:4px 8px;cursor:pointer">×</button></div><p style="color:#888;margin:0 0 8px">${results.length} targets · ${risky.length} flagged</p><ul style="margin:0;padding:0;list-style:none">${rows}</ul>`;
  panel.querySelector('#pg-audit-close')?.addEventListener('click', () => panel.remove());
  results.filter((r) => r.is_phishing).forEach((r) => {
    document.querySelectorAll(`a[href="${CSS.escape(r.url)}"]`).forEach((a) => {
      a.style.outline = '2px solid #e00';
      a.style.outlineOffset = '2px';
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PHISHGUARD_RESULT' && msg.result) {
    pageTabResult = msg.result;
    if (msg.settings) settings = { ...settings, ...msg.settings };
    highlightLinks(msg.result.is_phishing);
  }
  if (msg.type === 'PHISHGUARD_TOAST') {
    showToast(msg.url, msg.result);
  }
  if (msg.type === 'PHISHGUARD_AUDIT_PAGE') {
    const entries = collectPageLinks(msg.limit || 35);
    if (!entries.length) {
      sendResponse({ ok: true, results: [], message: 'No http(s) links on page.' });
      return true;
    }
    chrome.runtime.sendMessage({ type: 'PHISHGUARD_AUDIT_BATCH', items: entries }, (resp) => {
      if (resp?.ok && resp.results) showAuditPanel(resp.results);
      sendResponse(resp || { ok: false });
    });
    return true;
  }
});

attachHoverScan();