'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

type PredictResponse = {
  url: string;
  verdict: string;
  is_phishing: boolean;
  confidence: number;
  model_name: string;
  reasons: string[];
  features?: Record<string, number>;
};

type ModelStats = {
  best_model: string;
  test_metrics: {
    test_accuracy?: number;
    test_precision?: number;
    test_recall?: number;
    test_f1?: number;
    test_roc_auc?: number;
    confusion_matrix?: number[][];
    cv_accuracy_mean?: number;
    cv_accuracy_std?: number;
  };
};

const EXAMPLES = [
  {
    label: 'Safe — google.com',
    url: 'https://www.google.com/',
    kind: 'safe' as const,
  },
  {
    label: 'Safe — wikipedia.org',
    url: 'https://www.wikipedia.org/',
    kind: 'safe' as const,
  },
  {
    label: 'Phish — paypal lookalike',
    url: 'http://secure-paypal-login.verify-account.ru/signin',
    kind: 'phish' as const,
  },
  {
    label: 'Phish — IP login trap',
    url: 'http://192.168.1.1/login-verify-account',
    kind: 'phish' as const,
  },
];

function pct(n: number | undefined, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

function ConfidenceBar({ value, danger }: { value: number; danger: boolean }) {
  const width = Math.max(0, Math.min(100, value * 100));
  return (
    <div style={styles.barTrack} aria-hidden>
      <div
        style={{
          ...styles.barFill,
          width: `${width}%`,
          background: danger
            ? 'linear-gradient(90deg, #ff7875, var(--danger))'
            : 'linear-gradient(90deg, #36cfc9, var(--success))',
        }}
      />
    </div>
  );
}

function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  // PhiUSIIL: rows/cols ordered [phishing=0, benign=1]
  const tn = matrix?.[0]?.[0] ?? 0; // true phishing
  const fp = matrix?.[0]?.[1] ?? 0; // phishing → benign
  const fn = matrix?.[1]?.[0] ?? 0; // benign → phishing
  const tp = matrix?.[1]?.[1] ?? 0; // true benign
  const max = Math.max(tn, fp, fn, tp, 1);

  const cell = (n: number, good: boolean) => ({
    ...styles.cmCell,
    background: good
      ? `rgba(0, 212, 161, ${0.12 + (n / max) * 0.35})`
      : `rgba(255, 77, 79, ${0.1 + (n / max) * 0.3})`,
  });

  return (
    <div style={styles.cmWrap}>
      <div style={styles.cmGrid}>
        <div style={styles.cmCorner} />
        <div style={styles.cmHead}>Pred phish</div>
        <div style={styles.cmHead}>Pred benign</div>
        <div style={styles.cmHead}>True phish</div>
        <div style={cell(tn, true)} className="mono">
          {tn.toLocaleString()}
        </div>
        <div style={cell(fp, false)} className="mono">
          {fp.toLocaleString()}
        </div>
        <div style={styles.cmHead}>True benign</div>
        <div style={cell(fn, false)} className="mono">
          {fn.toLocaleString()}
        </div>
        <div style={cell(tp, true)} className="mono">
          {tp.toLocaleString()}
        </div>
      </div>
      <p style={styles.cmNote}>Rows = true label · Columns = prediction (0=phishing, 1=benign)</p>
    </div>
  );
}

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/model/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStats(data))
      .catch(() => undefined);
  }, []);

  const scan = useCallback(async (target: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    setUrl(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await scan(url);
  }

  const metrics = stats?.test_metrics;
  const metricCards = useMemo(
    () => [
      { label: 'Test accuracy', value: pct(metrics?.test_accuracy) },
      { label: 'Precision', value: pct(metrics?.test_precision) },
      { label: 'Recall', value: pct(metrics?.test_recall) },
      { label: 'F1', value: pct(metrics?.test_f1) },
      { label: 'ROC-AUC', value: pct(metrics?.test_roc_auc) },
      {
        label: 'CV accuracy',
        value:
          metrics?.cv_accuracy_mean != null
            ? `${pct(metrics.cv_accuracy_mean)} ± ${pct(metrics.cv_accuracy_std ?? 0, 2)}`
            : '—',
      },
    ],
    [metrics]
  );

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.brandRow}>
          <span style={styles.logoMark}>PG</span>
          <div>
            <p style={styles.kicker}>PhiUSIIL · URL-only · explainable ML</p>
            <h1 style={styles.title}>PhishGuard</h1>
          </div>
        </div>
        <p style={styles.subtitle}>
          Score a URL for phishing risk using lexical features only — no page crawl, no label leakage.
          Model: <span className="mono">{stats?.best_model ?? '…'}</span>
          {metrics?.test_accuracy != null && (
            <>
              {' '}
              · held-out accuracy <span className="mono">{pct(metrics.test_accuracy)}</span>
            </>
          )}
        </p>
      </header>

      <section style={styles.heroCard}>
        <form onSubmit={onSubmit} aria-label="URL check form">
          <label htmlFor="url-input" style={styles.label}>
            URL to check
          </label>
          <div style={styles.inputRow}>
            <input
              id="url-input"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://example.com/login…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              style={styles.input}
            />
            <button type="submit" disabled={loading || !url.trim()} style={styles.button}>
              {loading ? <span className="loading-dot">Checking…</span> : 'Check'}
            </button>
          </div>
        </form>

        <div style={styles.examples}>
          <span style={styles.examplesLabel}>Try an example</span>
          <div style={styles.chipRow}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.url}
                type="button"
                onClick={() => scan(ex.url)}
                disabled={loading}
                style={{
                  ...styles.chip,
                  borderColor: ex.kind === 'phish' ? 'rgba(255,77,79,0.35)' : 'rgba(0,212,161,0.35)',
                  color: ex.kind === 'phish' ? 'var(--danger)' : 'var(--success)',
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" style={{ ...styles.card, borderColor: 'var(--danger)' }}>
          <strong>Could not scan URL.</strong> {error}
        </div>
      )}

      {result && (
        <section
          style={{
            ...styles.card,
            borderColor: result.is_phishing ? 'rgba(255,77,79,0.45)' : 'rgba(0,212,161,0.45)',
            background: result.is_phishing
              ? 'linear-gradient(180deg, rgba(255,77,79,0.08), var(--bg-elevated))'
              : 'linear-gradient(180deg, rgba(0,212,161,0.08), var(--bg-elevated))',
          }}
          aria-live="polite"
        >
          <div style={styles.verdictTop}>
            <div>
              <p style={styles.verdictEyebrow}>Verdict</p>
              <h2
                style={{
                  ...styles.verdictTitle,
                  color: result.is_phishing ? 'var(--danger)' : 'var(--success)',
                }}
              >
                {result.is_phishing ? 'Phishing' : 'Safe'}
              </h2>
            </div>
            <div style={styles.confidenceBlock}>
              <div style={styles.confidenceHeader}>
                <span>Confidence</span>
                <span className="mono" style={{ fontWeight: 600, fontSize: 18 }}>
                  {(result.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <ConfidenceBar value={result.confidence} danger={result.is_phishing} />
              <p style={styles.modelLine}>
                Model <span className="mono">{result.model_name}</span>
              </p>
            </div>
          </div>

          <p className="mono" style={styles.urlPreview}>
            {result.url}
          </p>

          <h3 style={styles.h3}>Risk signals</h3>
          <ul style={styles.list}>
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p style={styles.disclaimer}>
            Advisory only — confirm with Safe Browsing, your SOC, or manual review before blocking users.
          </p>
        </section>
      )}

      <section style={styles.statsSection}>
        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>How it works</h2>
          <p style={styles.sectionSub}>
            Trained on the PhiUSIIL phishing URL dataset with a domain-grouped holdout and
            StratifiedGroupKFold (k=5). Live scoring uses only deployable lexical features from the raw
            URL string.
          </p>
        </div>

        <div style={styles.metricGrid}>
          {metricCards.map((m) => (
            <div key={m.label} style={styles.metricCard}>
              <p style={styles.metricLabel}>{m.label}</p>
              <p className="mono" style={styles.metricValue}>
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {metrics?.confusion_matrix && (
          <div style={styles.card}>
            <h3 style={styles.h3}>Confusion matrix (held-out test)</h3>
            <ConfusionMatrix matrix={metrics.confusion_matrix} />
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <p>
          API <code className="mono">{API_BASE}</code> · Chrome extension hits the same{' '}
          <code className="mono">/predict</code> endpoint.
        </p>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 920,
    margin: '0 auto',
    padding: '48px 24px 96px',
  },
  header: { marginBottom: 36 },
  brandRow: { display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: '-0.02em',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid rgba(0,112,243,0.35)',
    flexShrink: 0,
  },
  kicker: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    margin: '0 0 4px',
  },
  title: {
    fontSize: 40,
    fontWeight: 600,
    letterSpacing: '-0.045em',
    margin: 0,
    lineHeight: 1.1,
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 16,
    lineHeight: 1.65,
    margin: 0,
    maxWidth: 680,
  },
  heroCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 24,
    marginBottom: 20,
    boxShadow: 'var(--shadow)',
  },
  label: { display: 'block', fontSize: 14, marginBottom: 10, fontWeight: 500 },
  inputRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  input: {
    flex: '1 1 280px',
    fontSize: 16,
    padding: '14px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    background: '#000',
    color: 'var(--text)',
    fontFamily: "'Geist Mono', ui-monospace, monospace",
  },
  button: {
    flex: '0 0 auto',
    minWidth: 120,
    padding: '14px 22px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid transparent',
    background: 'var(--text)',
    color: '#000',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  examples: { marginTop: 20 },
  examplesLabel: {
    display: 'block',
    fontSize: 12,
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 24,
    marginBottom: 16,
    boxShadow: 'var(--shadow)',
  },
  verdictTop: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 28,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  verdictEyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  verdictTitle: {
    margin: '6px 0 0',
    fontSize: 36,
    fontWeight: 650,
    letterSpacing: '-0.03em',
  },
  confidenceBlock: { minWidth: 220, flex: '1 1 220px', maxWidth: 320 },
  confidenceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.35s ease',
  },
  modelLine: {
    margin: '10px 0 0',
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  urlPreview: {
    margin: '0 0 20px',
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid var(--border)',
    fontSize: 13,
    wordBreak: 'break-all',
    color: 'var(--text-secondary)',
  },
  h3: { fontSize: 15, margin: '0 0 12px', fontWeight: 600 },
  list: { margin: 0, paddingLeft: 20, lineHeight: 1.7, color: 'var(--text)' },
  disclaimer: { color: 'var(--text-muted)', fontSize: 12, marginTop: 18, marginBottom: 0 },
  statsSection: { marginTop: 40 },
  sectionHead: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    margin: '0 0 8px',
  },
  sectionSub: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 640,
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '16px 18px',
  },
  metricLabel: {
    margin: '0 0 8px',
    fontSize: 12,
    color: 'var(--text-secondary)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  metricValue: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  cmWrap: { marginTop: 4 },
  cmGrid: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 1fr',
    gap: 8,
    alignItems: 'stretch',
    maxWidth: 420,
  },
  cmCorner: {},
  cmHead: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  cmCell: {
    borderRadius: 'var(--radius-sm)',
    padding: '16px 8px',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: 16,
    border: '1px solid var(--border)',
  },
  cmNote: {
    margin: '12px 0 0',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  footer: {
    marginTop: 48,
    color: 'var(--text-muted)',
    fontSize: 13,
    borderTop: '1px solid var(--border)',
    paddingTop: 20,
  },
};
