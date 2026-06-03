'use client';

import { useState } from 'react';
import type { HistoryItem } from '@/lib/history';
import { itemScore } from '@/lib/history';

interface Props {
  history: HistoryItem[];
  onStart: (a: HistoryItem, b: HistoryItem) => void;
  onCancel: () => void;
}

const VERDICT_COLORS: Record<string, string> = {
  go: '#4ADE80',
  maybe: '#FACC15',
  kill: '#F87171',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function SlotCard({
  label,
  item,
  onClear,
}: {
  label: 'A' | 'B';
  item: HistoryItem | null;
  onClear: () => void;
}) {
  const score = item ? itemScore(item) : null;
  const verdict = item?.data?.result?.verdict ?? 'kill';
  const color = item ? (VERDICT_COLORS[verdict] ?? '#FACC15') : undefined;

  if (!item) {
    return (
      <div
        className="rounded-2xl border-2 border-dashed p-4 sm:p-5 flex flex-col items-center justify-center gap-2 min-h-[100px]"
        style={{ borderColor: 'rgba(184,255,92,0.2)' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-dashed flex items-center justify-center text-sm font-mono font-medium"
          style={{ borderColor: 'rgba(184,255,92,0.3)', color: 'rgba(184,255,92,0.4)' }}
        >
          {label}
        </div>
        <div className="text-xs text-text-30 text-center">Elegir del ranking ↓</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5 flex flex-col gap-2"
      style={{ borderColor: `${color}40`, background: `${color}07` }}
    >
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-full"
          style={{ background: `${color}22`, color }}
        >
          Prod. {label}
        </div>
        <button
          onClick={onClear}
          className="text-[10px] text-text-30 hover:text-text-60 transition-colors"
        >
          ✕ Quitar
        </button>
      </div>
      <div className="text-sm text-text-80 leading-snug line-clamp-2">
        {item.data?.product?.title ?? 'Sin título'}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-2xl tabular-nums leading-none" style={{ color }}>
          {score}
        </span>
        <div className="text-xs font-mono text-text-40 space-y-0.5">
          <div>{item.data?.margin?.multiple}x margen</div>
          <div>{item.data?.product?.country}</div>
        </div>
      </div>
    </div>
  );
}

export default function BattleSelector({ history, onStart, onCancel }: Props) {
  const [slotA, setSlotA] = useState<HistoryItem | null>(null);
  const [slotB, setSlotB] = useState<HistoryItem | null>(null);

  const available = history.filter(h => h.status !== 'discarded');
  const canStart = !!slotA && !!slotB && slotA.id !== slotB.id;

  const handleSelect = (item: HistoryItem) => {
    if (slotA?.id === item.id) { setSlotA(null); return; }
    if (slotB?.id === item.id) { setSlotB(null); return; }
    if (!slotA) { setSlotA(item); return; }
    if (!slotB) { setSlotB(item); return; }
    // Both full → replace oldest (A)
    setSlotA(item);
  };

  const slotOf = (item: HistoryItem): 'A' | 'B' | null => {
    if (slotA?.id === item.id) return 'A';
    if (slotB?.id === item.id) return 'B';
    return null;
  };

  return (
    <div className="animate-fade-up space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="text-sm text-text-40 hover:text-text-80 transition-colors flex items-center gap-1.5 shrink-0"
        >
          ← Volver
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-[0.16em] font-mono"
              style={{ color: '#B8FF5C' }}
            >
              Battle Mode
            </span>
          </div>
          <p className="text-xs text-text-40 mt-0.5">
            Elegí dos productos para comparar cuál merece el Launch Command.
          </p>
        </div>
      </div>

      {/* Slots */}
      <div>
        <div className="grid grid-cols-[1fr_40px_1fr] gap-2 items-start">
          <SlotCard label="A" item={slotA} onClear={() => setSlotA(null)} />
          <div className="self-center text-center">
            <div
              className="font-display text-lg leading-none"
              style={{ color: canStart ? '#B8FF5C' : 'rgba(255,255,255,0.2)' }}
            >
              VS
            </div>
          </div>
          <SlotCard label="B" item={slotB} onClear={() => setSlotB(null)} />
        </div>

        {/* Comparison preview */}
        {canStart && slotA && slotB && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center py-1">
            {[
              {
                label: 'Score',
                a: String(itemScore(slotA)),
                b: String(itemScore(slotB)),
                aWin: itemScore(slotA) > itemScore(slotB),
                bWin: itemScore(slotB) > itemScore(slotA),
              },
              {
                label: 'Margen',
                a: slotA.data?.margin?.multiple ? `${slotA.data.margin.multiple}x` : '–',
                b: slotB.data?.margin?.multiple ? `${slotB.data.margin.multiple}x` : '–',
                aWin: (slotA.data?.margin?.multiple ?? 0) > (slotB.data?.margin?.multiple ?? 0),
                bWin: (slotB.data?.margin?.multiple ?? 0) > (slotA.data?.margin?.multiple ?? 0),
              },
              {
                label: 'Tendencia',
                a: slotA.data?.signals?.trendsInterest != null ? `${slotA.data.signals.trendsInterest}` : '–',
                b: slotB.data?.signals?.trendsInterest != null ? `${slotB.data.signals.trendsInterest}` : '–',
                aWin: (slotA.data?.signals?.trendsInterest ?? -1) > (slotB.data?.signals?.trendsInterest ?? -1),
                bWin: (slotB.data?.signals?.trendsInterest ?? -1) > (slotA.data?.signals?.trendsInterest ?? -1),
              },
            ].map(({ label, a, b, aWin, bWin }) => (
              <div key={label}>
                <div className="text-[9px] font-mono text-text-30 uppercase tracking-[0.1em] mb-1">{label}</div>
                <div className="flex justify-center items-center gap-1.5">
                  <span className="text-xs font-mono tabular-nums" style={{ color: aWin ? '#B8FF5C' : 'rgba(255,255,255,0.4)' }}>{a}</span>
                  <span className="text-text-20 text-[9px]">·</span>
                  <span className="text-xs font-mono tabular-nums" style={{ color: bWin ? '#B8FF5C' : 'rgba(255,255,255,0.4)' }}>{b}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run battle button */}
      <button
        onClick={() => slotA && slotB && onStart(slotA, slotB)}
        disabled={!canStart}
        className="w-full py-4 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: canStart ? 'rgba(184,255,92,0.15)' : 'rgba(255,255,255,0.04)',
          border: canStart ? '1px solid rgba(184,255,92,0.4)' : '1px solid rgba(255,255,255,0.06)',
          color: canStart ? '#B8FF5C' : 'rgba(255,255,255,0.2)',
          cursor: canStart ? 'pointer' : 'not-allowed',
        }}
      >
        {canStart ? '⚔ Iniciar Battle →' : `Seleccioná 2 productos del ranking (${(slotA ? 1 : 0) + (slotB ? 1 : 0)}/2)`}
      </button>

      {/* Product list */}
      {available.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <p className="text-sm text-text-40">No hay productos disponibles.</p>
          <p className="text-xs text-text-30 mt-1">Analizá al menos 2 productos antes de usar Battle Mode.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-40">
              Ranking disponible
            </span>
            <span
              className="text-[10px] font-mono rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(184,255,92,0.12)', color: '#B8FF5C' }}
            >
              {available.length}
            </span>
          </div>
          <div className="space-y-2">
            {available.map((item, idx) => {
              const score = itemScore(item);
              const verdict = item.data?.result?.verdict ?? 'kill';
              const color = VERDICT_COLORS[verdict] ?? '#F87171';
              const slot = slotOf(item);
              const isSelected = slot !== null;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full rounded-xl border text-left transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{
                    borderColor: isSelected ? 'rgba(184,255,92,0.4)' : 'rgba(255,255,255,0.07)',
                    background: isSelected ? 'rgba(184,255,92,0.05)' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    {/* Rank / slot badge */}
                    <div
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-medium"
                      style={isSelected
                        ? { background: 'rgba(184,255,92,0.22)', color: '#B8FF5C' }
                        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.36)' }
                      }
                    >
                      {slot ?? (idx + 1)}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-80 truncate leading-tight">
                        {item.data?.product?.title ?? 'Sin título'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono" style={{ color }}>{score}/100</span>
                        <span className="text-[10px] text-text-20">·</span>
                        <span className="text-[10px] font-mono text-text-30">
                          {item.data?.margin?.multiple}x
                        </span>
                        <span className="text-[10px] text-text-20">·</span>
                        <span className="text-[10px] text-text-30">{item.data?.product?.country}</span>
                        <span className="text-[10px] text-text-20">·</span>
                        <span className="text-[10px] text-text-30">{timeAgo(item.savedAt)}</span>
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {isSelected ? (
                      <div
                        className="shrink-0 text-[10px] font-mono px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(184,255,92,0.15)', color: '#B8FF5C' }}
                      >
                        Prod. {slot}
                      </div>
                    ) : (
                      <div
                        className="shrink-0 text-[10px] font-mono px-2 py-1 rounded-lg border"
                        style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}
                      >
                        Elegir
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
