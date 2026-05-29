export type HistoryStatus = 'active' | 'favorite' | 'discarded';

export interface HistoryItem {
  id: string;
  savedAt: string;
  status: HistoryStatus;
  data: any;
}

const KEY = 'etest_history_v1';
const MAX = 30;

export function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}

export function addToHistory(data: any): HistoryItem[] {
  const item: HistoryItem = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
    status: 'active',
    data,
  };
  const prev = loadHistory().filter(
    h => !(
      h.data?.product?.title === data?.product?.title &&
      h.data?.product?.country === data?.product?.country
    )
  );
  const next = [item, ...prev].slice(0, MAX);
  persist(next);
  return next;
}

export function setItemStatus(id: string, status: HistoryStatus): HistoryItem[] {
  const next = loadHistory().map(h => h.id === id ? { ...h, status } : h);
  persist(next);
  return next;
}

export function removeItem(id: string): HistoryItem[] {
  const next = loadHistory().filter(h => h.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): void { persist([]); }

export function getRanked(items: HistoryItem[]): HistoryItem[] {
  return [...items]
    .filter(h => h.status !== 'discarded')
    .sort((a, b) => itemScore(b) - itemScore(a));
}

export function itemScore(item: HistoryItem): number {
  return item.data?.result?.adjustedScore ?? item.data?.result?.score ?? 0;
}

function persist(items: HistoryItem[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* quota */ }
}
