export type SampleUrl = { label: string; url: string; note?: string };

export const SAMPLE_URLS: SampleUrl[] = [
  {
    label: 'Benign',
    url: 'https://github.com',
    note: 'Clean baseline',
  },
  {
    label: 'Lookalike',
    url: 'http://paypa1-secure-login.example.test/verify?user=you',
    note: 'Homoglyph + login path',
  },
  {
    label: 'IP host',
    url: 'http://192.168.0.1/login?redirect=http://evil.test',
    note: 'Raw IP + redirect',
  },
  {
    label: '@ trap',
    url: 'http://customer-support@fake-bank.example.test/confirm',
    note: 'Userinfo masking',
  },
  {
    label: 'Deep subs',
    url: 'https://sub1.sub2.sub3.sub4.phish-lookalike.example.test/path',
    note: 'Nested subdomains',
  },
];