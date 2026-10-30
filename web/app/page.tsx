'use client';

import { FormEvent, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

type PredictResponse = {
  url: string;
  verdict: string;
  is_phishing: boolean;
  confidence: number;
  model_name: string;
  reasons: string[];
};

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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
  }

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <p style={styles.kicker}>PhiUSIIL · URL-only track</p>
        <h1 style={styles.title}>PhishGuard</h1>
        <p style={styles.subtitle}>
          Paste a URL to score phishing risk using lexical features only — no page crawl, no label leakage.
        </p>
      </header>

      <form onSubmit={onSubmit} style={styles.card} aria-label="URL check form">
        <label htmlFor="url-input" style={styles.label}>
          URL to check
        </label>
        <input
          id="url-input"
          name="url"
          type="url"
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
          {loading ? 'Scanning…' : 'Scan URL'}
        </button>
      </form>

      {error && (
        <div role="alert" style={{ ...styles.card, borderColor: 'var(--danger)' }}>
          <strong>Could not scan URL.</strong> {error}
        </div>
      )}

      {result && (
        <section style={styles.card} aria-live="polite">
          <div style={styles.verdictRow}>
            <span
              style={{
                ...styles.badge,
                background: result.is_phishing ? 'rgba(238,0,0,0.15)' : 'rgba(80,227,194,0.12)',
                color: result.is_phishing ? 'var(--danger)' : 'var(--success)',
              }}
            >
              {result.verdict.toUpperCase()}
            </span>
            <span style={styles.meta}>
              Confidence{' '}
              <span style={styles.mono}>{(result.confidence * 100).toFixed(1)}%</span> · Model{' '}
              <span style={styles.mono}>{result.model_name}</span>
            </span>
          </div>
          <h2 style={styles.h2}>Why</h2>
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

      <footer style={styles.footer}>
        <p>
          API: <code style={styles.mono}>{API_BASE}</code> · Chrome extension checks the active tab against the same backend.
        </p>
      </footer>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 20px 80px',
  },
  header: { marginBottom: 32 },
  kicker: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: '0 0 8px',
  },
  title: {
    fontSize: 40,
    fontWeight: 600,
    letterSpacing: '-0.04em',
    margin: '0 0 12px',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: 16,
    lineHeight: 1.6,
    margin: 0,
  },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 20,
    marginBottom: 16,
    boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 8px 30px rgba(0,0,0,0.35)',
  },
  label: { display: 'block', fontSize: 14, marginBottom: 8, fontWeight: 500 },
  input: {
    width: '100%',
    fontSize: 16,
    padding: '12px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: '#000',
    color: 'var(--text)',
    marginBottom: 12,
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--text)',
    color: '#000',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  verdictRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    fontFamily: 'Geist Mono, monospace',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: 999,
  },
  meta: { color: 'var(--text-secondary)', fontSize: 14 },
  mono: { fontFamily: 'Geist Mono, monospace', fontVariantNumeric: 'tabular-nums' },
  h2: { fontSize: 18, margin: '8px 0 12px' },
  list: { margin: 0, paddingLeft: 20, lineHeight: 1.6 },
  disclaimer: { color: 'var(--text-secondary)', fontSize: 13, marginTop: 16 },
  footer: { marginTop: 40, color: 'var(--text-secondary)', fontSize: 13 },
};
