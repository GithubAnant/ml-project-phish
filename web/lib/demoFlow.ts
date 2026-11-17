export const DEMO_STEPS = [
  {
    title: '1. Benign baseline',
    url: 'https://github.com',
    talk: 'Clean URL — low subdomain noise, HTTPS, known host.',
  },
  {
    title: '2. Lookalike',
    url: 'http://paypa1-secure-login.example.test/verify?user=you',
    talk: 'Homoglyph + login path — model + heuristics both react.',
  },
  {
    title: '3. Userinfo trap',
    url: 'http://customer-support@fake-bank.example.test/confirm',
    talk: '@ hides destination — classic phish pattern.',
  },
] as const;