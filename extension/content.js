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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PHISHGUARD_RESULT' && msg.result) {
    highlightLinks(msg.result.is_phishing);
  }
});
