'use client';

import { useState } from 'react';
import { ExtensionPanel } from './ExtensionPanel';
import { HowItWorks } from './HowItWorks';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'api', label: 'API' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'browser', label: 'Browser' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

type Props = {
  apiBase: string;
  apiOk: boolean | null;
  dotClass: string;
  statusLabel: string;
  endpoints: { method: string; path: string; desc: string }[];
};

export function SettingsView({ apiBase, apiOk, dotClass, statusLabel, endpoints }: Props) {
  const [section, setSection] = useState<SectionId>('overview');

  return (
    <div className="settings-shell">
      <nav className="settings-rail" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className="settings-rail-item"
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {section === 'overview' && (
          <section className="settings-section">
            <header className="settings-head">
              <h2>Overview</h2>
              <p className="muted">PhiUSIIL URL-only model, local FastAPI, optional OpenRouter Copilot.</p>
            </header>
            <div className="set-group">
              <div className="set-row set-row--status">
                <div>
                  <p className="set-label">API</p>
                  <p className="set-hint">
                    <span className={dotClass} /> {statusLabel}
                  </p>
                </div>
                <code className="set-value mono break">{apiBase}</code>
              </div>
            </div>
            <HowItWorks />
          </section>
        )}

        {section === 'api' && (
          <section className="settings-section">
            <header className="settings-head">
              <h2>API</h2>
              <p className="muted">Same endpoints as the web app, extension, and Copilot tools.</p>
            </header>
            <div className="set-group">
              <table className="table endpoints">
                <tbody>
                  {endpoints.map((e) => (
                    <tr key={e.path}>
                      <td className="endpoint-method">
                        <span className={`method method--${e.method.toLowerCase()}`}>{e.method}</span>
                      </td>
                      <td className="endpoint-path mono">{e.path}</td>
                      <td className="muted">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <pre className="code" aria-label="Example request">
              <span className="code-comment"># score a URL</span>
              {`\ncurl -X POST ${apiBase}/predict \\\n  -H 'Content-Type: application/json' \\\n  -d '{"url":"http://paypa1-secure-login.example.test"}'\n`}
            </pre>
          </section>
        )}

        {section === 'copilot' && (
          <section className="settings-section">
            <header className="settings-head">
              <h2>Copilot</h2>
              <p className="muted">Server-side OpenRouter bridge with scan tool calls.</p>
            </header>
            <div className="set-group">
              <div className="set-row">
                <div>
                  <p className="set-label">OPENROUTER_API_KEY</p>
                  <p className="set-hint">Set on the machine running uvicorn. Not exposed to the browser.</p>
                </div>
              </div>
              <div className="set-row">
                <div>
                  <p className="set-label">OPENROUTER_MODEL</p>
                  <p className="set-hint">Optional override in server env; defaults to a capable chat model.</p>
                </div>
              </div>
              <div className="set-row">
                <div>
                  <p className="set-label">Tools</p>
                  <p className="set-hint">
                    <code>scan_url</code>, <code>scan_urls_batch</code>, <code>get_model_info</code>
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {section === 'browser' && (
          <section className="settings-section">
            <header className="settings-head">
              <h2>Browser</h2>
              <p className="muted">Chrome extension — tab badge, hover preview, page audit.</p>
            </header>
            <ExtensionPanel apiBase={apiBase} apiOk={apiOk} />
          </section>
        )}
      </div>
    </div>
  );
}