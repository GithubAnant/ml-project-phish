'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { APP_NAME } from './Logo';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'Why was this URL flagged?',
  'What features does the model use?',
  'Scan paypa1-secure-login.example.test for me',
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, loading, error]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || `Chat failed (${res.status})`);
      }
      setMessages([...next, { role: 'assistant', content: body.reply || 'No response.' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat error');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const last = messages[messages.length - 1];
  const busy = loading && last?.role === 'user';

  return (
    <section className="chat-shell" aria-label={`${APP_NAME} copilot`}>
      <div className="chat-thread" ref={threadRef} aria-live="polite" aria-busy={loading}>
        {messages.length === 0 && (
          <div className="chat-welcome">
            <h2 className="chat-welcome-title">Ask about a URL</h2>
            <p className="muted">Metrics, verdicts, or a live scan — Copilot calls the same model via tools.</p>
            <ul className="chat-welcome-links">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button type="button" className="chat-link" onClick={() => void send(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={`${i}-${m.role}`} role={m.role} content={m.content} streaming={busy && i === messages.length - 1 && m.role === 'user'} />
        ))}

        {busy && (
          <div className="msg msg--thinking" aria-hidden>
            <span className="msg-thinking-dot" />
            Thinking…
          </div>
        )}

        {error && (
          <div className="chat-error">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUser) void send(lastUser.content);
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="chat-composer-wrap">
        <form onSubmit={onSubmit} className="composer" data-working={loading ? 'true' : undefined}>
          <textarea
            ref={inputRef}
            className="composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message Copilot…"
            aria-label="Message Copilot"
            disabled={loading}
            rows={1}
          />
          <div className="composer-rail">
            <span className="composer-hint muted small">Enter to send · Shift+Enter for newline</span>
            <button type="submit" className="composer-send" disabled={loading || !input.trim()} aria-label="Send">
              ↑
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Bubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  return (
    <div className={`msg msg--${role === 'user' ? 'me' : 'bot'}${streaming ? ' msg--pending' : ''}`}>
      {role === 'assistant' && <span className="msg-label">Copilot</span>}
      <p>{content}</p>
    </div>
  );
}