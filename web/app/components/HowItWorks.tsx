const STEPS = [
  {
    n: '01',
    title: 'Paste a URL',
    body: 'Hosts without https:// are normalized automatically. Live lexical hints while you type.',
  },
  {
    n: '02',
    title: 'Model scores structure',
    body: 'PhiUSIIL URL-only classifier — subdomain count, TLD, HTTPS, entropy. No page crawl.',
  },
  {
    n: '03',
    title: 'Act on evidence',
    body: 'Reasons + feature grid + Copilot with tool calls. Extension audits buttons and links.',
  },
];

export function HowItWorks() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <h2 id="how-title" className="section-title">
        How it works
      </h2>
      <p className="muted">Three steps from raw string to evidence. Same pipeline in the app, API and extension.</p>
      <ol className="steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="step-num mono">{s.n}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
