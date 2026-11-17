'use client';

import { useState } from 'react';
import { APP_NAME } from './Logo';

const FEATURES = [
  { title: 'Tab badge', body: 'Risk band on the icon for the current page when the API is up.' },
  { title: 'Hover preview', body: 'Quick model/heuristic readout when you hover links.' },
  { title: 'Page audit', body: 'Scan anchors, formaction, data-* URLs, and onclick targets.' },
  { title: 'Right-click', body: 'Scan any link from the context menu.' },
];

type Props = {
  apiBase: string;
  apiOk: boolean | null;
};

export function ExtensionPanel({ apiBase, apiOk }: Props) {
  const [copied, setCopied] = useState<'path' | 'api' | null>(null);

  const instructions = `Load ${APP_NAME} (Chrome)

1. Open chrome://extensions
2. Turn on Developer mode
3. Click "Load unpacked"
4. Select the extension/ folder in the URLSentinel repo

API base in extension settings should match:
${apiBase}`;

  function copy(text: string, kind: 'path' | 'api') {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="ext">
      <div className="ext-hero panel">
        <div className="ext-hero-copy">
          <h2 className="ext-title">Chrome extension</h2>
          <p className="muted">
            Same <code>/predict</code> model as this app — scores links while you browse. Local API only unless you add host permissions in{' '}
            <code>manifest.json</code>.
          </p>
          <div className="ext-actions">
            <a className="btn btn--primary" href="/extension.zip" download={`${APP_NAME.toLowerCase()}-extension.zip`}>
              Download zip
            </a>
            <button type="button" className="btn btn--secondary" onClick={() => copy(instructions, 'path')}>
              {copied === 'path' ? 'Copied ✓' : 'Copy install steps'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => copy(apiBase, 'api')}>
              {copied === 'api' ? 'Copied ✓' : 'Copy API URL'}
            </button>
          </div>
          <p className={`ext-api small${apiOk === false ? ' text-danger' : ''}`}>
            <span className={`dot${apiOk === true ? ' dot--ok' : apiOk === false ? ' dot--bad' : ''}`} />
            {apiOk === true ? 'API reachable — extension can use the model.' : apiOk === false ? 'Start the API on :8000 before scanning in the browser.' : 'Checking API…'}
          </p>
        </div>
        <ol className="ext-steps" aria-label="Install steps">
          <li>
            <span className="ext-step-n">1</span>
            <span>
              Download and unzip, or use <code>extension/</code> from the repo.
            </span>
          </li>
          <li>
            <span className="ext-step-n">2</span>
            <span>
              <code>chrome://extensions</code> → Developer mode → <strong>Load unpacked</strong>.
            </span>
          </li>
          <li>
            <span className="ext-step-n">3</span>
            <span>
              Pin {APP_NAME}. Set API base to <code className="break">{apiBase}</code> in the popup if needed.
            </span>
          </li>
          <li>
            <span className="ext-step-n">4</span>
            <span>Open any http(s) tab — the popup scans the active URL automatically.</span>
          </li>
        </ol>
      </div>

      <ul className="ext-features">
        {FEATURES.map((f) => (
          <li key={f.title} className="panel ext-feature">
            <h3>{f.title}</h3>
            <p className="muted small">{f.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}