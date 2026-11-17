'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { SettingsView } from './components/SettingsView';
import { APP_NAME, Logo } from './components/Logo';
import { ConfidenceRing } from './components/ConfidenceRing';
import { FeatureGrid } from './components/FeatureGrid';
import { loadHistory, pushHistory, type HistoryEntry } from '../lib/history';
import { SAMPLE_URLS } from '../lib/samples';
import type { BatchRow, ModelInfo, PredictResponse } from '../lib/types';
import { DEMO_STEPS } from '../lib/demoFlow';
import { normalizeBatchInput, normalizeUrlInput } from '../lib/normalizeUrl';
import { getUrlHints } from '../lib/urlHints';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

const ENDPOINTS = [
  { method: 'GET', path: '/health', desc: 'Liveness + model artifact present' },
  { method: 'POST', path: '/predict', desc: 'Score one URL — verdict, confidence, reasons, features' },
  { method: 'GET', path: '/model/info', desc: 'Model name, trained_at, hold-out metrics' },
  { method: 'POST', path: '/chat', desc: 'Copilot — OpenRouter with scan tool calls' },
];

const CHECKS = ['URL length', 'Subdomains', 'HTTPS', 'IP host', '@ userinfo', 'Digit ratio', 'Special chars', 'Dot count', 'TLD risk', 'Entropy'];

type AppView = 'scan' | 'workspace' | 'system';

const VIEW_NAV: { id: AppView; label: string; icon: string }[] = [
  { id: 'scan', label: 'Scan', icon: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35' },
  { id: 'workspace', label: 'Copilot', icon: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z' },
  { id: 'system', label: 'Settings', icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' },
];

async function predictOne(url: string): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

const pct = (v: number | undefined, digits = 1) => (v != null ? `${(v * 100).toFixed(digits)}%` : '—');

export default function HomePage() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [url, setUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [demoIdx, setDemoIdx] = useState(0);
  const [demoRunning, setDemoRunning] = useState(false);
  const [urlFixNote, setUrlFixNote] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [view, setView] = useState<AppView>('scan');

  const hints = useMemo(() => getUrlHints(url), [url]);

  useEffect(() => {
    setHistory(loadHistory());
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((d) => setApiOk(d.status === 'ok'))
      .catch(() => setApiOk(false));
    fetch(`${API_BASE}/model/info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setModelInfo(d))
      .catch(() => setModelInfo(null));
  }, []);

  const runScan = useCallback(async (target: string, announceFix = true) => {
    const { value: normalized, fixed } = normalizeUrlInput(target);
    if (!normalized) return;
    setUrl(normalized);
    if (fixed && announceFix) {
      setUrlFixNote(`Added https:// — scanning as ${normalized}`);
      window.setTimeout(() => setUrlFixNote(null), 4000);
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await predictOne(normalized);
      setResult(data);
      setHistory(pushHistory(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  function handleUrlBlur() {
    const { value, fixed } = normalizeUrlInput(url);
    if (fixed) {
      setUrl(value);
      setUrlFixNote('Added https://');
      window.setTimeout(() => setUrlFixNote(null), 3000);
    }
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').trim();
    if (!text || /^https?:\/\//i.test(text)) return;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(text)) {
      e.preventDefault();
      const { value } = normalizeUrlInput(text);
      setUrl(value);
      setUrlFixNote('Pasted host — added https://');
      window.setTimeout(() => setUrlFixNote(null), 3000);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runScan(url);
  }

  async function runPresenterDemo() {
    setDemoRunning(true);
    setMode('single');
    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setDemoIdx(i);
      await runScan(DEMO_STEPS[i].url);
      await new Promise((r) => setTimeout(r, 1200));
    }
    setDemoRunning(false);
  }

  async function onBatchSubmit(e: FormEvent) {
    e.preventDefault();
    const { lines, fixedCount } = normalizeBatchInput(batchText);
    if (!lines.length) return;
    if (fixedCount > 0) {
      setBatchText(lines.join('\n'));
      setUrlFixNote(`Added https:// to ${fixedCount} line${fixedCount > 1 ? 's' : ''}`);
      window.setTimeout(() => setUrlFixNote(null), 3500);
    }
    setLoading(true);
    setError(null);
    setBatchRows([]);
    const rows: BatchRow[] = [];
    for (const line of lines) {
      try {
        const data = await predictOne(line);
        rows.push(data);
        pushHistory(data);
      } catch (err) {
        rows.push({
          url: line,
          verdict: 'error',
          is_phishing: false,
          confidence: 0,
          model_name: '—',
          reasons: [],
          error: err instanceof Error ? err.message : 'Failed',
        });
      }
    }
    setBatchRows(rows);
    setHistory(loadHistory());
    setLoading(false);
  }

  function copyReport() {
    if (!result) return;
    const text = [
      `${APP_NAME} report`,
      `URL: ${result.url}`,
      `Verdict: ${result.verdict} (${(result.confidence * 100).toFixed(1)}%)`,
      `Model: ${result.model_name}`,
      '',
      'Reasons:',
      ...result.reasons.map((r) => `• ${r}`),
    ].join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    });
  }

  const m = modelInfo?.metrics;
  const modelName = modelInfo?.model_name ?? result?.model_name ?? '—';
  const liveMetrics = [
    { label: 'Accuracy', value: pct(m?.test_accuracy) },
    { label: 'F1', value: pct(m?.test_f1) },
    { label: 'ROC AUC', value: m?.test_roc_auc != null ? m.test_roc_auc.toFixed(3) : '—' },
    { label: 'Recall', value: pct(m?.test_recall) },
  ];
  const statusLabel = apiOk === true ? 'API online' : apiOk === false ? 'API offline' : 'Checking API…';
  const dotClass = `dot${apiOk === true ? ' dot--ok' : apiOk === false ? ' dot--bad' : ''}`;
  return (
    <div className="app">
      <aside className="sidebar" aria-label="App">
        <div className="sidebar-brand">
          <Logo size={22} />
        </div>

        <nav className="nav" aria-label="Sections">
          {VIEW_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-item"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={item.icon} />
              </svg>
              {item.label}
              {item.id === 'scan' && history.length > 0 && <span className="nav-count">{history.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-group">
          <p className="sidebar-label">Model</p>
          <p className="sidebar-model mono" title={modelName}>
            {modelName}
          </p>
          <dl className="kv" aria-label="Model metrics">
            {liveMetrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <button type="button" className="sidebar-status" title={API_BASE} onClick={() => setView('system')}>
          <span className={dotClass} />
          <span className="sidebar-status-text">
            <span>{statusLabel}</span>
            <span className="mono">{API_BASE.replace(/^https?:\/\//, '')}</span>
          </span>
        </button>
      </aside>

      <main className={`main main--${view}`}>
        {view === 'scan' && (
          <div className="view-stage view-stage--wide">
            <PageHead title="Scan" body="URL-only scoring — no page fetch. Check one link or paste a batch.">
              <div className="demo">
                <span className="demo-talk">{demoRunning ? DEMO_STEPS[demoIdx].talk : 'Benign → lookalike → @ trap'}</span>
                <button type="button" className="btn btn--secondary btn--sm" disabled={demoRunning || loading} onClick={() => void runPresenterDemo()}>
                  {demoRunning ? `Step ${demoIdx + 1}/${DEMO_STEPS.length}` : 'Run demo'}
                </button>
              </div>
            </PageHead>

            <section className="panel scan">
              <div className="panel-bar">
                <div className="segmented" role="tablist" aria-label="Scan mode">
                  <button type="button" role="tab" aria-selected={mode === 'single'} onClick={() => setMode('single')}>
                    Single
                  </button>
                  <button type="button" role="tab" aria-selected={mode === 'batch'} onClick={() => setMode('batch')}>
                    Batch
                  </button>
                </div>
                <span className="panel-bar-meta">
                  {mode === 'single' ? (
                    <>
                      <kbd>Enter</kbd> to scan
                    </>
                  ) : (
                    'Sequential /predict calls'
                  )}
                </span>
                <div className={`progress${loading ? ' progress--on' : ''}`} aria-hidden />
              </div>

              <div className="scan-split">
                <div className="scan-input">
                  {mode === 'single' ? (
                    <form onSubmit={onSubmit} aria-label="URL check form">
                      <label htmlFor="url-input" className="label">
                        URL
                      </label>
                      <div className="input-row">
                        <div className="input-wrap">
                          <input
                            id="url-input"
                            name="url"
                            type="text"
                            inputMode="url"
                            autoComplete="off"
                            spellCheck={false}
                            autoCapitalize="off"
                            autoCorrect="off"
                            placeholder="google.com or https://…"
                            value={url}
                            onChange={(e) => {
                              setUrl(e.target.value);
                              setUrlFixNote(null);
                            }}
                            onBlur={handleUrlBlur}
                            onPaste={handleUrlPaste}
                            required
                            className="field"
                            aria-describedby="url-fix-msg"
                          />
                          {url.trim() ? (
                            <button
                              type="button"
                              className="btn-clear"
                              aria-label="Clear URL"
                              onClick={() => {
                                setUrl('');
                                setResult(null);
                                setError(null);
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                        <button type="submit" disabled={loading || !url.trim()} className="btn btn--primary">
                          {loading ? 'Scanning…' : 'Scan'}
                        </button>
                      </div>
                      <p id="url-fix-msg" className="fix-note" role="status">
                        {urlFixNote || ' '}
                      </p>

                      <p className="label">Samples</p>
                      <div className="chips" aria-label="Sample URLs">
                        {SAMPLE_URLS.map((s) => (
                          <button key={s.url} type="button" className="chip" title={s.note} onClick={() => void runScan(s.url)}>
                            {s.label}
                          </button>
                        ))}
                      </div>

                      <p className="label">Live signals</p>
                      {hints.length > 0 ? (
                        <ul className="hints" aria-label="Live URL signals">
                          {hints.map((h) => (
                            <li key={h.text} className={`hint hint--${h.level}`}>
                              {h.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Lexical red flags show here as you type — before you scan.</p>
                      )}
                    </form>
                  ) : (
                    <form onSubmit={onBatchSubmit} aria-label="Batch URL check form">
                      <label htmlFor="batch-input" className="label">
                        URLs — one per line
                      </label>
                      <textarea
                        id="batch-input"
                        className="field field--textarea"
                        placeholder={'google.com\npaypa1-secure.example.test/login'}
                        value={batchText}
                        onChange={(e) => setBatchText(e.target.value)}
                      />
                      <p className="fix-note" role="status">
                        {urlFixNote || ' '}
                      </p>
                      <button type="submit" disabled={loading || !batchText.trim()} className="btn btn--primary btn--block">
                        {loading ? 'Scanning batch…' : 'Scan all'}
                      </button>
                      <p className="muted small">Results are saved to history.</p>
                    </form>
                  )}
                </div>

                <div className="scan-output" aria-live="polite">
                  {error ? (
                    <p role="alert" className="alert">
                      {error}
                      {apiOk === false && ' — start uvicorn on :8000 with a trained model.'}
                    </p>
                  ) : null}

                  {mode === 'batch' ? (
                    batchRows.length > 0 ? (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>URL</th>
                            <th>Verdict</th>
                            <th className="num">Conf.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchRows.map((row) => (
                            <tr key={row.url}>
                              <td className="mono break">{row.url}</td>
                              <td>
                                {row.error ? (
                                  <span className="text-danger">{row.error}</span>
                                ) : (
                                  <span className={`badge ${row.is_phishing ? 'badge--phish' : 'badge--safe'}`}>{row.verdict}</span>
                                )}
                              </td>
                              <td className="mono num">{row.error ? '—' : `${(row.confidence * 100).toFixed(0)}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      !error && <Empty title={loading ? 'Scoring batch…' : 'No batch yet'} body="Paste a list on the left. Each line gets a verdict and confidence." />
                    )
                  ) : result ? (
                    <div className="result">
                      <div className="result-head">
                        <ConfidenceRing confidence={result.confidence} isPhishing={result.is_phishing} size={88} />
                        <div className="result-meta">
                          <span className={`badge badge--lg ${result.is_phishing ? 'badge--phish' : 'badge--safe'}`}>{result.verdict.toUpperCase()}</span>
                          <p className="mono break result-url">{result.url}</p>
                          <p className="muted small">
                            Model <span className="mono fg">{result.model_name}</span>
                          </p>
                        </div>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={copyReport}>
                          {copyOk ? 'Copied ✓' : 'Copy report'}
                        </button>
                      </div>
                      <p className="label">Why</p>
                      <ul className="reasons">
                        {result.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      {result.features && Object.keys(result.features).length > 0 && (
                        <>
                          <p className="label">Features</p>
                          <FeatureGrid features={result.features} />
                        </>
                      )}
                      <p className="muted small">Advisory only — not sole enforcement.</p>
                    </div>
                  ) : (
                    !error && (
                      <Empty title={loading ? 'Scoring…' : 'Waiting for a URL'} body="The model scores these lexical features — no page fetch, no crawl.">
                        <div className="tags">
                          {CHECKS.map((c) => (
                            <span key={c} className="tag">
                              {c}
                            </span>
                          ))}
                        </div>
                      </Empty>
                    )
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'workspace' && (
          <div className="view-stage view-stage--chat">
            <PageHead title="Copilot" body="Ask about URLs, model metrics, or request a live scan." />
            <div className="copilot copilot--solo">
              <ChatPanel />
            </div>
          </div>
        )}

        {view === 'system' && (
          <div className="view-stage view-stage--settings">
            <PageHead title="Settings" body="API, Copilot env, and Chrome extension." />
            <SettingsView apiBase={API_BASE} apiOk={apiOk} dotClass={dotClass} statusLabel={statusLabel} endpoints={ENDPOINTS} />
          </div>
        )}
      </main>
    </div>
  );
}

function PageHead({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {body && <p>{body}</p>}
      </div>
      {children}
    </header>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <p className="muted">{body}</p>
      {children}
    </div>
  );
}
