'use client';

import type { HistoryItem, HistoryStatus } from '@/lib/history';
import { getRanked, itemScore } from '@/lib/history';

interface Props {
  history: HistoryItem[];
  newLeaderId?: string | null;
  onView: (item: HistoryItem) => void;
  onStatusChange: (id: string, status: HistoryStatus) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const VERDICT_COLORS: Record<string, string> = {
  go: '#4ADE80',
  maybe: '#FACC15',
  kill: '#F87171',
};

function rankBadge(idx: number): { bg: string; color: string } {
  if (idx === 0) return { bg: 'rgba(184,255,92,0.22)', color: '#B8FF5C' };
  if (idx === 1) return { bg: 'rgba(250,204,21,0.14)', color: '#FACC15' };
  if (idx === 2) return { bg: 'rgba(251,146,60,0.14)', color: '#FB923C' };
  return { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.36)' };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}


export default function HistoryPanel({
  history,
  newLeaderId,
  onView,
  onStatusChange,
  onRemove,
  onClear,
}: Props) {
  const ranked = getRanked(history);
  const discarded = history.filter(h => h.status === 'discarded');
  const leaderScore = ranked.length > 0 ? itemScore(ranked[0]) : null;

  if (history.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Ranking ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.14em] font-mono text-text-60">Ranking</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-mono"
              style={{ background: 'rgba(184,255,92,0.12)', color: '#B8FF5C' }}
            >
              {ranked.length}
            </span>
          </div>
          <button
            onClick={onClear}
            className="text-[10px] font-mono text-text-30 hover:text-text-60 transition-colors"
          >
            Limpiar
          </button>
        </div>

        <div className="space-y-1.5">
          {ranked.map((item, idx) => {
            const score = itemScore(item);
            const verdict = item.data?.result?.verdict ?? 'kill';
            const color = VERDICT_COLORS[verdict] ?? '#F87171';
            const isFav = item.status === 'favorite';
            const isLeader = idx === 0;
            const isNewLeader = item.id === newLeaderId && isLeader;
            const title = item.data?.product?.title ?? 'Sin título';
            const badge = rankBadge(idx);
            const delta = leaderScore !== null && idx > 0 ? score - leaderScore : null;

            return (
              <div
                key={item.id}
                className="group relative rounded-xl border transition-all"
                style={{
                  borderColor: isLeader ? 'rgba(184,255,92,0.2)' : 'rgba(255,255,255,0.06)',
                  background: isLeader ? 'rgba(184,255,92,0.03)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-center gap-2.5 p-2.5">
                  {/* Rank badge */}
                  <div
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-medium"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {idx + 1}
                  </div>

                  {/* Title + meta */}
                  <button onClick={() => onView(item)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className="text-sm text-text-80 truncate leading-tight group-hover:text-text-100 transition-colors">
                        {title}
                      </div>
                      {isNewLeader && (
                        <span
                          className="shrink-0 text-[8px] font-mono uppercase tracking-[0.1em] px-1 py-0.5 rounded"
                          style={{ background: 'rgba(184,255,92,0.18)', color: '#B8FF5C' }}
                        >
                          NUEVO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono" style={{ color }}>{score}</span>
                      <span className="text-[10px] text-text-30">·</span>
                      <span className="text-[10px] font-mono text-text-30">{item.data?.margin?.multiple}x</span>
                      <span className="text-[10px] text-text-30">·</span>
                      <span className="text-[10px] text-text-30">{timeAgo(item.savedAt)}</span>
                      {delta !== null && (
                        <>
                          <span className="text-[10px] text-text-30">·</span>
                          <span className="text-[10px] font-mono" style={{ color: '#F87171' }}>
                            {delta} pts
                          </span>
                        </>
                      )}
                      {isLeader && ranked.length > 1 && (
                        <>
                          <span className="text-[10px] text-text-30">·</span>
                          <span className="text-[10px] font-mono" style={{ color: '#B8FF5C' }}>
                            +{score - (itemScore(ranked[1]))} pts
                          </span>
                        </>
                      )}
                      {isFav && <span className="text-[10px]">★</span>}
                    </div>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onStatusChange(item.id, isFav ? 'active' : 'favorite')}
                      title={isFav ? 'Quitar favorito' : 'Favorito'}
                      className="w-6 h-6 rounded flex items-center justify-center text-[11px] transition-colors hover:text-text-80"
                      style={{ color: isFav ? '#FACC15' : 'rgba(255,255,255,0.24)' }}
                    >
                      ★
                    </button>
                    <button
                      onClick={() => onStatusChange(item.id, 'discarded')}
                      title="Ocultar del ranking"
                      className="w-6 h-6 rounded flex items-center justify-center text-[11px] transition-colors hover:text-score-red"
                      style={{ color: 'rgba(255,255,255,0.16)' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Leader indicator bar */}
                {isLeader && (
                  <div
                    className="mx-2.5 mb-2 h-px rounded-full"
                    style={{ background: 'linear-gradient(90deg, rgba(184,255,92,0.4) 0%, rgba(184,255,92,0) 100%)' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Discarded */}
      {discarded.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">
            Ocultos del ranking ({discarded.length})
          </div>
          <p className="text-[10px] text-text-20 mb-2 leading-snug">
            No eliminados — podés restaurarlos cuando quieras.
          </p>
          <div className="space-y-1">
            {discarded.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.08)' }}
              >
                <span className="flex-1 text-xs text-text-30 truncate">
                  {item.data?.product?.title ?? 'Sin título'}
                </span>
                <button
                  onClick={() => onStatusChange(item.id, 'active')}
                  className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors shrink-0"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; }}
                >
                  Restaurar
                </button>
                <button
                  onClick={() => onRemove(item.id)}
                  title="Eliminar permanentemente"
                  className="text-[10px] text-text-20 hover:text-score-red transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
