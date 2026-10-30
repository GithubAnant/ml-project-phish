import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PhishGuard — URL Risk Scanner',
  description: 'Check URLs with the URL-only PhiUSIIL-trained model',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
