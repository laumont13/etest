'use client';

import { useState } from 'react';
import { Card, SectionHeader, CopyButton, DecisionCheckpoint } from '../ui';
import { canMarkTabReady } from '../helpers';
import type { LaunchCommandData, UserEdits, TabDecision, TabStatus } from '../types';

interface Props {
  data: LaunchCommandData;
  edits: UserEdits;
  onEditsChange: (e: UserEdits) => void;
  onGoNext?: () => void;
}

type CreativeMode = 'pre-sample' | 'sample' | 'post-validation';

const MODES = [
  { id: 'pre-sample' as CreativeMode, label: 'Pre-muestra', desc: 'Conceptos estáticos seguros, sin demos, sin claims no validados' },
  { id: 'sample' as CreativeMode, label: 'Muestra recibida', desc: 'Demo real, textura, uso, close-ups propios' },
  { id: 'post-validation' as CreativeMode, label: 'Post-validación', desc: 'Claims fuertes solo si están respaldados por prueba real' },
];

type AdStatus = 'not-started' | 'in-production' | 'testing' | 'winner' | 'paused';

const STATUS_MAP: Record<AdStatus, { label: string; color: string }> = {
  'not-started':  { label: 'No iniciado',  color: 'rgba(255,255,255,0.3)' },
  'in-production':{ label: 'En producción', color: '#60A5FA' },
  'testing':      { label: 'Testeando',    color: '#FACC15' },
  'winner':       { label: 'Ganador',      color: '#4ADE80' },
  'paused':       { label: 'Pausado',      color: '#F87171' },
};

function AdStatusBadge({ status, onChange }: { status: AdStatus; onChange: (s: AdStatus) => void }) {
  const { label, color } = STATUS_MAP[status];
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value as AdStatus)}
      className="text-[9px] font-mono uppercase tracking-[0.1em] bg-transparent border-none focus:outline-none cursor-pointer"
      style={{ color }}
    >
      {(Object.keys(STATUS_MAP) as AdStatus[]).map(s => (
        <option key={s} value={s} style={{ background: '#111113', color: STATUS_MAP[s].color }}>
          {STATUS_MAP[s].label}
        </option>
      ))}
    </select>
  );
}

export default function CreativesTab({ data, edits, onEditsChange, onGoNext }: Props) {
  const { staticAds, ugcBriefs, hookVariations } = data.creativeTestingPlan;
  const decision = edits.tabDecisions.creativos ?? { status: 'pending' as TabStatus, note: '' };
  const { canMark, reason } = canMarkTabReady('creativos', data, edits);
  const [mode, setMode] = useState<CreativeMode>('pre-sample');
  const [adStatuses, setAdStatuses] = useState<Record<string, AdStatus>>({});
  const [diversity, setDiversity] = useState(false);

  function setDecision(d: TabDecision) {
    onEditsChange({ ...edits, tabDecisions: { ...edits.tabDecisions, creativos: d }, lastUpdated: new Date().toISOString() });
  }

  function setAdStatus(id: string, s: AdStatus) {
    setAdStatuses(prev => ({ ...prev, [id]: s }));
  }

  function adCopyText(ad: typeof staticAds[0]) {
    return [
      `CONCEPTO: ${ad.concept}`,
      `HOOK: ${ad.hook}`,
      `COPY: ${ad.copy}`,
      `QUÉ TESTEA: ${ad.whatItTests}`,
      `SEÑAL DE VICTORIA: ${ad.winSignal}`,
      `SI GANA: ${ad.winAction}`,
    ].join('\n');
  }

  function ugcScriptText(u: typeof ugcBriefs[0]) {
    return [
      `HOOK DE APERTURA: ${u.hook}`,
      `BRIEF: ${u.brief}`,
      `QUÉ TESTEA: ${u.whatItTests}`,
      `SEÑAL DE VICTORIA: ${u.winSignal}`,
    ].join('\n');
  }

  // Mock AI image prompt (derived from first angle)
  const firstAngle = data.creativeAngles[0];
  const aiImagePrompt = firstAngle
    ? `Product photography of ${data.product.title}, ${firstAngle.visualDirection.toLowerCase()}, clean background, studio lighting, high detail, no text, no logos, --ar 1:1`
    : null;

  // Mode-specific warnings
  const modeWarning: Record<CreativeMode, string | null> = {
    'pre-sample': null,
    'sample': 'Usá solo imágenes y videos propios del producto real. No reutilices renders del proveedor.',
    'post-validation': 'Solo usá claims validados por la muestra física. No extrapoles de la descripción del proveedor.',
  };

  const diversityWarning = staticAds.length > 1 && !diversity;

  return (
    <div className="space-y-4">
      <SectionHeader
        number="06"
        title="Creativos"
        sub="Briefs listos para producción. Cada pieza testea una hipótesis distinta — no variaciones del mismo concepto."
      />

      {/* Mode selector */}
      <div className="flex gap-2 p-1 rounded-xl border border-border-soft bg-bg-2 overflow-x-auto">
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="flex-1 px-3 py-2 rounded-lg text-left transition-all whitespace-nowrap min-w-fit"
            style={{
              background: mode === m.id ? 'rgba(255,255,255,0.07)' : 'transparent',
              borderBottom: mode === m.id ? '2px solid rgba(184,255,92,0.5)' : '2px solid transparent',
            }}
          >
            <div className="text-xs font-medium" style={{ color: mode === m.id ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
              {m.label}
            </div>
            <div className="text-[9px] text-text-30 mt-0.5 leading-relaxed">{m.desc}</div>
          </button>
        ))}
      </div>

      {modeWarning[mode] && (
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(250,204,21,0.2)', background: 'rgba(250,204,21,0.04)' }}>
          <p className="text-xs" style={{ color: '#FACC15' }}>{modeWarning[mode]}</p>
        </div>
      )}

      {/* Diversity warning */}
      {diversityWarning && (
        <div
          className="rounded-lg border px-3 py-2 flex items-center justify-between gap-3 cursor-pointer"
          style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.04)' }}
          onClick={() => setDiversity(true)}
        >
          <p className="text-xs" style={{ color: '#60A5FA' }}>Verificá que los creativos sean conceptualmente distintos, no variaciones del mismo hook.</p>
          <span className="text-[9px] font-mono text-text-30 shrink-0">Confirmar</span>
        </div>
      )}

      {/* Static Ads */}
      {staticAds.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Anuncios estáticos / imagen</div>
          <div className="space-y-3">
            {staticAds.map((ad, idx) => {
              const st = adStatuses[ad.id] ?? 'not-started';
              return (
                <div key={ad.id} className="rounded-xl border border-border-soft bg-bg-2 overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft bg-bg-3/30">
                    <span className="text-[9px] font-mono text-text-20 w-4">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-medium text-text-80 flex-1 truncate">{ad.concept}</span>
                    <AdStatusBadge status={st} onChange={s => setAdStatus(ad.id, s)} />
                    <CopyButton text={adCopyText(ad)} />
                  </div>
                  {/* Body */}
                  <div className="px-4 py-3 grid sm:grid-cols-2 gap-0">
                    <div className="py-2 border-b border-border-soft last:border-0 sm:border-r sm:border-b-0 sm:pr-4">
                      <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Hook — primeros 2 segundos</div>
                      <p className="text-sm text-text-80 leading-relaxed">"{ad.hook}"</p>
                    </div>
                    <div className="py-2 border-b border-border-soft last:border-0 sm:pl-4">
                      <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Copy / Texto del anuncio</div>
                      <p className="text-sm text-text-70 leading-relaxed">{ad.copy}</p>
                    </div>
                    <div className="py-2 border-b border-border-soft last:border-0 sm:border-r sm:pr-4">
                      <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Qué testea</div>
                      <p className="text-sm text-text-60">{ad.whatItTests}</p>
                    </div>
                    <div className="py-2 sm:pl-4">
                      <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Señal de victoria</div>
                      <p className="text-sm" style={{ color: '#4ADE80' }}>{ad.winSignal}</p>
                      {ad.winAction && <p className="text-[10px] text-text-30 mt-1">Si gana → {ad.winAction}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UGC Briefs */}
      {ugcBriefs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Briefs UGC / video</div>
          <div className="space-y-3">
            {ugcBriefs.map((u, idx) => (
              <div key={u.id} className="rounded-xl border border-border-soft bg-bg-2 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft bg-bg-3/30">
                  <span className="text-[9px] font-mono text-text-20">UGC {String(idx + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-medium text-text-80 flex-1 truncate">"{u.hook}"</span>
                  <CopyButton text={ugcScriptText(u)} label="Copiar brief" />
                </div>
                <div className="px-4 py-3 grid sm:grid-cols-2 gap-0">
                  <div className="py-2 border-b border-border-soft sm:border-b-0 sm:border-r sm:pr-4">
                    <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Brief de grabación</div>
                    <p className="text-sm text-text-70 leading-relaxed">{u.brief}</p>
                  </div>
                  <div className="py-2 sm:pl-4">
                    <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Qué testea</div>
                    <p className="text-sm text-text-60 mb-2">{u.whatItTests}</p>
                    <div className="text-[10px] font-mono text-text-30 mb-1 uppercase tracking-[0.12em]">Señal de victoria</div>
                    <p className="text-sm" style={{ color: '#4ADE80' }}>{u.winSignal}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI image prompt */}
      {aiImagePrompt && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30">Prompt para imagen AI (sin texto en la imagen)</div>
            <CopyButton text={aiImagePrompt} label="Copiar prompt" />
          </div>
          <p className="text-sm font-mono text-text-60 leading-relaxed bg-bg-3 rounded-lg px-3 py-2">
            {aiImagePrompt}
          </p>
        </Card>
      )}

      {/* CapCut notes */}
      <Card>
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-text-30 mb-2">Notas de edición (CapCut / video)</div>
        <ul className="space-y-1.5">
          {[
            'Primeros 2 segundos: hook visual que detiene el scroll — sin intro de marca',
            'Subtítulos en todo el video — la mayoría no tiene audio',
            'Ratio 9:16 para Reels/TikTok, 1:1 para Feed',
            'Transición en el momento de resolución — antes/después si aplica',
            'Música: energética pero que no compita con el copy de voz',
            'CTA verbal en los últimos 3 segundos + overlay de texto',
          ].map((n, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-60">
              <span className="shrink-0 mt-0.5 text-text-20">·</span>
              {n}
            </li>
          ))}
        </ul>
      </Card>

      <DecisionCheckpoint
        tabId="creativos"
        status={decision.status}
        note={decision.note}
        nextAction="Aprobar el primer batch → producir mínimo 1 estático + 1 UGC antes de pauta"
        nextTabLabel="Landing"
        canMarkReady={canMark}
        canMarkReadyReason={!canMark ? reason : undefined}
        onStatusChange={s => setDecision({ ...decision, status: s, decidedAt: new Date().toISOString() })}
        onNoteChange={n => setDecision({ ...decision, note: n })}
        onGoNext={onGoNext}
      />
    </div>
  );
}
