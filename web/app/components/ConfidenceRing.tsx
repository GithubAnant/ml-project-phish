type Props = {
  confidence: number;
  isPhishing: boolean;
  size?: number;
};

export function ConfidenceRing({ confidence, isPhishing, size = 120 }: Props) {
  const stroke = isPhishing ? 'var(--danger)' : 'var(--success)';
  const pct = Math.round(confidence * 100);
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - confidence);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ fontSize: Math.round(size * 0.22), fontWeight: 600, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: size < 100 ? 9 : 11, color: 'var(--text-secondary)', marginTop: 3 }}>confidence</span>
      </div>
    </div>
  );
}