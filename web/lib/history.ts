import type { PredictResponse } from './types';

const KEY = 'phishguard:history';
const MAX = 25;

export type HistoryEntry = PredictResponse & { scannedAt: string };

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushHistory(entry: PredictResponse): HistoryEntry[] {
  const item: HistoryEntry = { ...entry, scannedAt: new Date().toISOString() };
  const prev = loadHistory().filter((h) => h.url !== entry.url);
  const next = [item, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}