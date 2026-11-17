export const APP_NAME = 'URLSentinel';

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  name?: string;
  className?: string;
};

export function Logo({ size = 32, showWordmark = true, name = APP_NAME, className }: LogoProps) {
  return (
    <span className={`brand${className ? ` ${className}` : ''}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className="brand-mark">
        <path d="M24 4 8 11v13c0 10.5 7.2 19.6 16 22 8.8-2.4 16-11.5 16-22V11L24 4Z" fill="#ededed" />
        <path d="M17 25.5c2.4-5.6 6-8.5 9.8-8.5 3.1 0 5.4 1.6 6.7 4.4" stroke="#000" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="30.5" cy="14.5" r="2.4" fill="#0070f3" />
        <path d="M17 32h14" stroke="#000" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      </svg>
      {showWordmark && <span className="brand-wordmark">{name}</span>}
    </span>
  );
}
