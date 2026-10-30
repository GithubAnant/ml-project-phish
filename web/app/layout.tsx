import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PhishGuard — URL Risk Scanner',
  description: 'Explainable phishing URL detection trained on PhiUSIIL',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
