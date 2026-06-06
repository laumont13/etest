'use client';

// ─────────────────────────────────────────────────────────
// Launch Command — Shared UI Primitives
// ─────────────────────────────────────────────────────────

import { useState, type ReactNode } from 'react';
import type { TabStatus, ChecklistState } from './types';
import { calculateChecklistProgress } from './helpers';

// ── Card ─────────────────────────────────────────────────

export function Card({ children, className = '', accent }: { children: ReactNode; className?: string; accent?: string }) {
  const border = accent ? `rgba(${accent},0.2)` : undefined;
  const bg = accent ? `rgba(${accent},0.04)` : undefined;
  return (
    <div
      className={`rounded-xl border bg-bg-2 p-4 ${className}`}
      style={{ borderColor: border ?? 'rgba(255,255,255,0.06)', background: bg ?? '#16161A' }}
    >
      {children}
    </div>
  );
}

// ── InfoRow ───────────────────────────────────────────────

export function InfoRow({ label, value, danger, mono }: { label: string; value?: string | null; danger?: boolean; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border-soft last:border-0">
      <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">{label}</span>
      <span
        className={`text-sm leading-relaxed ${mono ? 'font-mono' : ''}`}
        style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.78)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ── BulletList ────────────────────────────────────────────

export function BulletList({ label, items, danger }: { label: string; items: string[]; danger?: boolean }) {
  const vis = items.filter(Boolean);
  if (!vis.length) return null;
  return (
    <div className="py-2 border-b border-border-soft last:border-0">
      <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 block mb-2">{label}</span>
      <ul className="space-y-1.5">
        {vis.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm" style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.72)' }}>
            <span className="shrink-0 mt-0.5" style={{ color: danger ? '#F87171' : 'rgba(255,255,255,0.22)' }}>·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────

export function SectionHeader({ number, title, sub }: { number: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 pb-3 border-b border-border-soft">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-[10px] font-mono text-text-30">{number}</span>
        <h3 className="font-display text-lg text-text-100">{title}</h3>
      </div>
      {sub && <p className="text-xs text-text-40 leading-relaxed mt-0.5">{sub}</p>}
    </div>
  );
}

// ── RiskBadge ─────────────────────────────────────────────

const RISK_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  high:    { bg: 'rgba(248,113,113,0.15)', text: '#F87171', label: 'Alto' },
  medium:  { bg: 'rgba(250,204,21,0.12)',  text: '#FACC15', label: 'Medio' },
  low:     { bg: 'rgba(74,222,128,0.12)',  text: '#4ADE80', label: 'Bajo' },
  critical:{ bg: 'rgba(248,113,113,0.25)', text: '#F87171', label: 'Crítico' },
};

export function RiskBadge({ level, label }: { level: string; label?: string }) {
  const c = RISK_COLORS[level] ?? RISK_COLORS.medium;
  return (
    <span className="text-[10px] font-mono uppercase tracking-[0.12em] px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text }}>
      {label ?? c.label}
    </span>
  );
}

// ── ConfidenceBadge ───────────────────────────────────────

export function ConfidenceBadge({ value }: { value: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   { color: '#4ADE80', label: 'Alta' },
    medium: { color: '#FACC15', label: 'Media' },
    low:    { color: '#F87171', label: 'Baja' },
  };
  const { color, label } = map[value];
  return (
    <span className="text-[10px] font-mono uppercase tracking-[0.12em] px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
      {label}
    </span>
  );
}

// ── StatusBadge ───────────────────────────────────────────

const STATUS_STYLES: Record<TabStatus, { bg: string; text: string; label: string }> = {
  pending:     { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.3)', label: 'Pendiente' },
  'in-progress':{ bg: 'rgba(96,165,250,0.12)',  text: '#60A5FA',              label: 'En progreso' },
  blocked:     { bg: 'rgba(250,204,21,0.12)',   text: '#FACC15',              label: 'Bloqueado' },
  ready:       { bg: 'rgba(74,222,128,0.12)',   text: '#4ADE80',              label: 'Listo' },
};

export function StatusBadge({ status }: { status: TabStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className="text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ── CopyButton ────────────────────────────────────────────

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="text-[10px] font-mono uppercase tracking-[0.12em] px-2.5 py-1 rounded-lg border transition-colors"
      style={{
        borderColor: copied ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)',
        color: copied ? '#4ADE80' : 'rgba(255,255,255,0.36)',
        background: copied ? 'rgba(74,222,128,0.06)' : 'transparent',
      }}
    >
      {copied ? 'Copiado' : label}
    </button>
  );
}

// ── EditableTextarea ──────────────────────────────────────

export function EditableTextarea({
  label, value, onChange, placeholder, rows = 2,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="py-2 border-b border-border-soft last:border-0">
      <label className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 block mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-bg-3 border border-border-soft rounded-lg px-3 py-2 text-sm text-text-80 resize-none focus:outline-none focus:border-accent/40 placeholder:text-text-20 transition-colors"
      />
    </div>
  );
}

// ── ChecklistModule ───────────────────────────────────────

export interface ChecklistItem {
  label: string;
  help?: string;
  required?: boolean;
}

interface ChecklistModuleProps {
  id: string; // unique key for localStorage grouping
  label?: string;
  items: ChecklistItem[];
  state: ChecklistState | undefined;
  onChange: (state: ChecklistState) => void;
  accentColor?: string;
}

export function ChecklistModule({ id, label, items, state, onChange, accentColor = '#4ADE80' }: ChecklistModuleProps) {
  const s = state ?? {};
  const progress = calculateChecklistProgress(items, s);
  const [showHelp, setShowHelp] = useState<number | null>(null);

  function toggle(i: number) {
    onChange({ ...s, [String(i)]: !s[String(i)] });
  }

  const progressColor = progress.pct === 100 ? '#4ADE80' : progress.pct >= 60 ? '#FACC15' : '#60A5FA';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        {label && <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">{label}</span>}
        <div className="flex items-center gap-3 ml-auto">
          {progress.requiredTotal > 0 && (
            <span className="text-[9px] font-mono" style={{ color: progress.canProceed ? '#4ADE80' : '#F87171' }}>
              {progress.requiredDone}/{progress.requiredTotal} requeridos
            </span>
          )}
          <span className="text-[9px] font-mono" style={{ color: progressColor }}>
            {progress.completed}/{progress.total}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-bg-3 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progress.pct}%`, background: progressColor }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item, i) => {
          const checked = s[String(i)] === true;
          const isShowingHelp = showHelp === i;
          return (
            <div key={i}>
              <div className="flex items-start gap-2.5">
                <button
                  onClick={() => toggle(i)}
                  className="w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all"
                  style={{
                    borderColor: checked ? accentColor : item.required ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.18)',
                    background: checked ? `${accentColor}22` : 'transparent',
                  }}
                >
                  {checked && (
                    <span className="text-[8px]" style={{ color: accentColor }}>✓</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-sm leading-relaxed"
                      style={{
                        color: checked ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.72)',
                        textDecoration: checked ? 'line-through' : 'none',
                      }}
                    >
                      {item.label}
                    </span>
                    {item.required && !checked && (
                      <span className="text-[8px] font-mono uppercase tracking-[0.1em] px-1 py-0.5 rounded" style={{ color: '#F87171', background: 'rgba(248,113,113,0.1)' }}>
                        Req.
                      </span>
                    )}
                    {item.help && (
                      <button
                        onClick={() => setShowHelp(isShowingHelp ? null : i)}
                        className="text-[9px] font-mono text-text-20 hover:text-text-40 transition-colors shrink-0"
                      >
                        ?
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {isShowingHelp && item.help && (
                <div className="ml-6.5 mt-1 pl-2 border-l border-border-soft">
                  <p className="text-xs text-text-30 leading-relaxed">{item.help}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Required items warning */}
      {progress.requiredTotal > 0 && !progress.canProceed && (
        <div className="mt-3 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.04)' }}>
          <p className="text-[10px]" style={{ color: '#F87171' }}>
            Completá los ítems marcados como requeridos para avanzar al siguiente paso.
          </p>
        </div>
      )}
    </div>
  );
}

// ── DecisionCheckpoint (with progression) ────────────────

interface CheckpointProps {
  tabId: string;
  status: TabStatus;
  note: string;
  nextAction: string;
  nextTabLabel?: string;
  canMarkReady: boolean;
  canMarkReadyReason?: string;
  onStatusChange: (s: TabStatus) => void;
  onNoteChange: (n: string) => void;
  onGoNext?: () => void;
}

export function DecisionCheckpoint({
  tabId, status, note, nextAction, nextTabLabel,
  canMarkReady, canMarkReadyReason,
  onStatusChange, onNoteChange, onGoNext,
}: CheckpointProps) {
  const s = STATUS_STYLES[status];

  return (
    <div className="mt-6 rounded-xl border border-border-soft bg-bg-2 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Checkpoint</div>
        <StatusBadge status={status} />
      </div>

      {/* Status toggles */}
      <div className="flex flex-wrap gap-1.5">
        {(['pending', 'in-progress', 'blocked', 'ready'] as TabStatus[]).map(st => (
          <button
            key={st}
            onClick={() => {
              if (st === 'ready' && !canMarkReady) return;
              onStatusChange(st);
            }}
            disabled={st === 'ready' && !canMarkReady}
            className="text-[10px] font-mono uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              borderColor: status === st ? STATUS_STYLES[st].text : 'rgba(255,255,255,0.1)',
              background: status === st ? STATUS_STYLES[st].bg : 'transparent',
              color: status === st ? STATUS_STYLES[st].text : 'rgba(255,255,255,0.3)',
            }}
            title={st === 'ready' && !canMarkReady && canMarkReadyReason ? canMarkReadyReason : undefined}
          >
            {STATUS_STYLES[st].label}
          </button>
        ))}
      </div>

      {/* Can't mark ready reason */}
      {canMarkReadyReason && status !== 'ready' && (
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(250,204,21,0.15)', background: 'rgba(250,204,21,0.04)' }}>
          <p className="text-xs" style={{ color: '#FACC15' }}>{canMarkReadyReason}</p>
        </div>
      )}

      {/* Note input */}
      <textarea
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder="Nota sobre la decisión (opcional)"
        rows={2}
        className="w-full bg-bg-3 border border-border-soft rounded-lg px-3 py-2 text-sm text-text-70 resize-none focus:outline-none focus:border-accent/40 placeholder:text-text-20 transition-colors"
      />

      {/* Next action / next step CTA */}
      {status === 'ready' && onGoNext ? (
        <button
          onClick={onGoNext}
          className="w-full py-2.5 rounded-lg border font-medium text-sm transition-all"
          style={{ borderColor: 'rgba(184,255,92,0.4)', background: 'rgba(184,255,92,0.08)', color: '#B8FF5C' }}
        >
          Continuar {nextTabLabel ? `a ${nextTabLabel}` : 'al siguiente paso'} →
        </button>
      ) : (
        <div className="rounded-lg border border-border-soft bg-bg-3/40 px-3 py-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-text-30">Próxima acción · </span>
          <span className="text-xs text-text-50">{nextAction}</span>
        </div>
      )}
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────

export function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Card>
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-1">{label}</div>
      <div className="font-display text-3xl tabular-nums leading-none" style={{ color: color ?? 'rgba(255,255,255,0.96)' }}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-text-30 mt-1">{sub}</div>}
    </Card>
  );
}

// ── NumberInput ───────────────────────────────────────────

export function NumberInput({ label, value, onChange, prefix, suffix, placeholder, hint }: {
  label: string;
  value: number | '';
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30">{label}</label>
      {hint && <span className="text-[10px] text-text-20 -mt-0.5">{hint}</span>}
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-xs font-mono text-text-40 shrink-0">{prefix}</span>}
        <input
          type="number"
          value={value === '' ? '' : value}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          placeholder={placeholder ?? '0'}
          className="flex-1 bg-bg-3 border border-border-soft rounded-lg px-2.5 py-1.5 text-sm text-text-90 tabular-nums focus:outline-none focus:border-accent/40 placeholder:text-text-20 transition-colors min-w-0"
          min={0}
          step="any"
        />
        {suffix && <span className="text-xs font-mono text-text-40 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

// ── OutputRow ─────────────────────────────────────────────

export function OutputRow({ label, value, sub, highlight, danger }: {
  label: string; value: string; sub?: string; highlight?: boolean; danger?: boolean;
}) {
  const color = danger ? '#F87171' : highlight ? '#B8FF5C' : 'rgba(255,255,255,0.78)';
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-border-soft last:border-0 gap-4">
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.12em] font-mono text-text-30">{label}</span>
        {sub && <span className="text-[9px] font-mono text-text-20">{sub}</span>}
      </div>
      <span className="text-sm font-mono tabular-nums shrink-0" style={{ color, fontWeight: highlight ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );
}
