const LABELS: Record<string, string> = {
  url_length: 'URL length',
  num_subdomains: 'Subdomains',
  is_https: 'HTTPS',
  is_ip_host: 'IP host',
  has_at_symbol: 'Has @',
  digit_ratio: 'Digit ratio',
  special_ratio: 'Special char ratio',
  num_dots: 'Dot count',
  suspicious_tld: 'Suspicious TLD',
  entropy: 'Entropy',
};

function formatValue(key: string, v: number): string {
  if (key.startsWith('is_') || key === 'has_at_symbol' || key === 'suspicious_tld') {
    return v >= 0.5 ? 'Yes' : 'No';
  }
  if (key.includes('ratio')) return `${(v * 100).toFixed(1)}%`;
  if (key === 'entropy') return v.toFixed(2);
  return String(Math.round(v));
}

function isFlagged(key: string, v: number): boolean {
  if (key === 'is_https') return v < 0.5;
  if (key === 'is_ip_host' || key === 'has_at_symbol' || key === 'suspicious_tld') return v >= 0.5;
  if (key === 'num_subdomains') return v >= 3;
  if (key === 'digit_ratio' || key === 'special_ratio') return v > 0.25;
  if (key === 'entropy') return v > 4.5;
  return false;
}

type Props = { features: Record<string, number> };

export function FeatureGrid({ features }: Props) {
  const keys = Object.keys(features).filter((k) => k in LABELS);
  if (!keys.length) return null;

  return (
    <div className="feature-grid">
      {keys.map((key) => {
        const v = features[key];
        const flagged = isFlagged(key, v);
        return (
          <div key={key} className={`feature-cell${flagged ? ' feature-cell--flag' : ''}`}>
            <span className="feature-label">{LABELS[key] ?? key}</span>
            <span className="feature-value">{formatValue(key, v)}</span>
          </div>
        );
      })}
    </div>
  );
}