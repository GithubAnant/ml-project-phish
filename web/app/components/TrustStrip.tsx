const ITEMS = [
  { label: 'Dataset', value: 'PhiUSIIL · 235k URLs' },
  { label: 'Deploy track', value: 'Lexical only' },
  { label: 'Split', value: 'Domain-grouped hold-out' },
  { label: 'Integrations', value: 'API · Extension · Copilot' },
];

type Item = { label: string; value: string };

export function TrustStrip({ metrics = [] }: { metrics?: Item[] }) {
  return (
    <div className="trust" role="list" aria-label="Model facts">
      {[...ITEMS, ...metrics].map((item) => (
        <div key={item.label} className="trust-item" role="listitem">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
