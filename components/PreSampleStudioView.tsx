'use client';

import { useState, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ColorPalette {
  name: string; primary: string; secondary: string;
  background: string; accent: string; text: string; useCase: string;
}
interface ImagePrompt {
  id: string; name: string; purpose: string; format: string;
  scene: string; prompt: string; negativePrompt: string; safeBecause: string;
}
interface StaticCreative {
  id: string; name: string; angle: string; hook: string; format: string;
  mainCopy: string; visualConcept: string; imagePromptId: string;
  cta: string; placement: string; priority: 'alta' | 'media' | 'baja'; whatItValidates: string;
}
interface CarouselSlide { slide: number; text: string; visualSuggestion: string; }
interface Carousel {
  id: string; title: string; objective: string; slides: CarouselSlide[]; ctaFinal: string;
}
interface StoreSection { name: string; goal: string; copy: string; visualNeeded: string; }
interface FAQ { question: string; answer: string; }
interface StoreStructure {
  platformSuggestion: string; heroHeadline: string; heroSubheadline: string; primaryCTA: string;
  benefitBullets: string[]; productDescriptionShort: string; productDescriptionLong: string;
  sections: StoreSection[]; faqs: FAQ[];
}
interface ShotItem {
  id: string; shot: string; purpose: string;
  howToFilm: string; creativeAngle: string; priority: 'alta' | 'media' | 'baja';
}
export interface PreSampleData {
  mode: string; goal: string;
  market: { country: string; language: string; currency: string; tone: string; localizationNotes: string[] };
  brandDirection: {
    brandStyle: string; tone: string; desiredPerception: string; mainPromise: string;
    customerType: string; wordsToUse: string[]; wordsToAvoid: string[]; visualKeywords: string[];
  };
  colorPalettes: ColorPalette[];
  graphicStyle: { typographyDirection: string; layoutStyle: string; photoStyle: string; iconStyle: string; designRules: string[] };
  imagePrompts: ImagePrompt[];
  staticCreatives: StaticCreative[];
  carousels: Carousel[];
  storeStructure: StoreStructure;
  sampleArrivalShotList: ShotItem[];
  nextActions: string[];
}

interface Props { data: PreSampleData; productTitle?: string; onBack: () => void; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  alta:  { bg: 'rgba(74,222,128,0.12)',  color: '#4ADE80' },
  media: { bg: 'rgba(250,204,21,0.12)', color: '#FACC15' },
  baja:  { bg: 'rgba(148,163,184,0.10)', color: '#94A3B8' },
};
function PriorityBadge({ p }: { p: string }) {
  const s = PRIORITY_STYLE[p] ?? PRIORITY_STYLE.baja;
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide" style={{ background: s.bg, color: s.color }}>
      {p}
    </span>
  );
}

function FormatBadge({ fmt }: { fmt: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-bg-3 border border-border-soft text-text-40 tracking-wide">
      {fmt}
    </span>
  );
}

function Chip({ text, color }: { text: string; color?: string }) {
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs border"
      style={{
        background: color ? color + '14' : 'rgba(255,255,255,0.04)',
        borderColor: color ? color + '30' : 'rgba(255,255,255,0.08)',
        color: color ?? 'rgba(255,255,255,0.56)',
      }}
    >
      {text}
    </span>
  );
}

function isValidHex(s: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s.trim());
}

function ColorSwatch({ hex, size = 22 }: { hex: string; size?: number }) {
  const safe = isValidHex(hex) ? hex : '#333';
  return (
    <span
      className="inline-block rounded border border-white/10 shrink-0"
      style={{ width: size, height: size, background: safe }}
      title={hex}
    />
  );
}

function SectionHeader({
  id, title, count, collapsed, onToggle,
}: { id: string; title: string; count?: number; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-border-soft bg-bg-1/60 hover:border-border-mid transition-colors text-left"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-medium text-text-80">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-text-40 bg-bg-3 px-1.5 py-0.5 rounded">{count}</span>
        )}
      </div>
      <span className="text-text-40 text-xs transition-transform" style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
        ▾
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PreSampleStudioView({ data, productTitle, onBack }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const [copied, setCopied]       = useState<string | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [expandedDesc, setExpandedDesc]       = useState(false);
  const [expandedStore, setExpandedStore]     = useState(false);
  const [activeFaq, setActiveFaq]             = useState<number | null>(null);

  const toggleSection = (id: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const isCollapsed = (id: string) => collapsed.has(id);

  const copyText = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }, []);

  const toggleFav  = (id: string) => setFavorites(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDisc = (id: string) => setDiscarded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExpandPrompt = (id: string) => setExpandedPrompts(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `pre-sample-studio-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const cols = ['id', 'name', 'angle', 'hook', 'format', 'mainCopy', 'cta', 'placement', 'priority', 'whatItValidates'] as const;
    const header = cols.join(',');
    const rows = (data.staticCreatives ?? [])
      .filter(c => !discarded.has(c.id))
      .map(c => cols.map(k => `"${(c[k] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `creativos-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportShotListText = () => {
    const lines = (data.sampleArrivalShotList ?? []).map((s, i) =>
      `${i + 1}. ${s.shot}\n   Para: ${s.purpose}\n   Cómo: ${s.howToFilm}\n   Ángulo: ${s.creativeAngle}\n   Prioridad: ${s.priority}`
    );
    copyText(lines.join('\n\n'), 'shot-list-all');
  };

  const activeCreatives = (data.staticCreatives ?? []).filter(c => !discarded.has(c.id));
  const favCreatives    = activeCreatives.filter(c => favorites.has(c.id));
  const restCreatives   = activeCreatives.filter(c => !favorites.has(c.id));

  const CopyBtn = ({ text, id, label = 'Copiar' }: { text: string; id: string; label?: string }) => (
    <button
      onClick={() => copyText(text, id)}
      className="px-2.5 py-1 rounded-lg text-[11px] border transition-colors"
      style={{
        borderColor: copied === id ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)',
        color: copied === id ? '#4ADE80' : 'rgba(255,255,255,0.48)',
        background: copied === id ? 'rgba(74,222,128,0.08)' : 'transparent',
      }}
    >
      {copied === id ? '✓ Copiado' : label}
    </button>
  );

  // ── Creative card
  const CreativeCard = ({ c }: { c: StaticCreative }) => {
    const isFav  = favorites.has(c.id);
    const fullText = `HOOK: ${c.hook}\n\nCOPY: ${c.mainCopy}\n\nÁNGULO: ${c.angle}\nFORMATO: ${c.format}\nPLACEMENT: ${c.placement}\nCTA: ${c.cta}\nVALIDA: ${c.whatItValidates}`;
    return (
      <div
        className="rounded-xl border p-4 flex flex-col gap-3 transition-all"
        style={{
          background: isFav ? 'rgba(250,204,21,0.04)' : 'rgba(255,255,255,0.02)',
          borderColor: isFav ? 'rgba(250,204,21,0.25)' : 'rgba(255,255,255,0.07)',
        }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <FormatBadge fmt={c.format} />
            <PriorityBadge p={c.priority} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => toggleFav(c.id)}
              className="text-sm leading-none transition-opacity"
              style={{ opacity: isFav ? 1 : 0.35 }}
              title="Favorito"
            >
              ★
            </button>
            <button
              onClick={() => toggleDisc(c.id)}
              className="text-sm leading-none text-text-40 hover:text-score-red transition-colors"
              title="Descartar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Hook */}
        <p className="text-sm font-medium text-text-100 leading-snug">"{c.hook}"</p>

        {/* Fields */}
        <div className="space-y-1.5 text-xs text-text-60">
          {c.angle      && <div><span className="text-text-30 uppercase tracking-wide text-[10px]">Ángulo  </span>{c.angle}</div>}
          {c.mainCopy   && <div><span className="text-text-30 uppercase tracking-wide text-[10px]">Copy    </span>{c.mainCopy}</div>}
          {c.visualConcept && <div><span className="text-text-30 uppercase tracking-wide text-[10px]">Visual  </span>{c.visualConcept}</div>}
          {c.placement  && <div><span className="text-text-30 uppercase tracking-wide text-[10px]">Placement </span>{c.placement}</div>}
          {c.cta        && <div><span className="text-text-30 uppercase tracking-wide text-[10px]">CTA     </span>{c.cta}</div>}
          {c.whatItValidates && (
            <div className="pt-1 mt-1 border-t border-border-soft">
              <span className="text-[10px] text-text-30 uppercase tracking-wide">Valida </span>
              <span className="text-text-40">{c.whatItValidates}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border-soft">
          <span className="text-[10px] font-mono text-text-20">{c.id}</span>
          <CopyBtn text={fullText} id={c.id} label="Copiar creativo" />
        </div>
      </div>
    );
  };

  // ── Image prompt card
  const PromptCard = ({ p }: { p: ImagePrompt }) => {
    const expanded = expandedPrompts.has(p.id);
    return (
      <div className="rounded-xl border border-border-soft bg-bg-1/40 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FormatBadge fmt={p.format} />
            <span className="text-xs text-text-60 font-medium">{p.name}</span>
          </div>
          <span className="text-[10px] font-mono text-text-20">{p.id}</span>
        </div>
        {p.purpose && <p className="text-[11px] text-text-40 italic">{p.purpose}</p>}
        {p.scene   && <p className="text-xs text-text-60">{p.scene}</p>}

        {/* Prompt toggle */}
        <div>
          <button
            onClick={() => toggleExpandPrompt(p.id)}
            className="text-[11px] text-accent/70 hover:text-accent transition-colors mb-1"
          >
            {expanded ? '▾ Ocultar prompt' : '▸ Ver prompt completo'}
          </button>
          {expanded && (
            <div className="rounded-lg bg-bg-3 border border-border-soft p-3 space-y-2">
              <div>
                <span className="text-[9px] text-text-30 uppercase tracking-widest block mb-1">PROMPT (inglés)</span>
                <p className="text-xs text-text-80 font-mono leading-relaxed">{p.prompt}</p>
              </div>
              {p.negativePrompt && (
                <div>
                  <span className="text-[9px] text-score-red/60 uppercase tracking-widest block mb-1">NEGATIVE</span>
                  <p className="text-xs text-text-40 font-mono">{p.negativePrompt}</p>
                </div>
              )}
              {p.safeBecause && (
                <div>
                  <span className="text-[9px] text-score-green/60 uppercase tracking-widest block mb-1">SEGURO PORQUE</span>
                  <p className="text-xs text-text-40">{p.safeBecause}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1 border-t border-border-soft">
          <CopyBtn text={p.prompt} id={`prompt-${p.id}`} label="Copiar prompt" />
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-up space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-0.5 text-sm text-text-40 hover:text-text-80 transition-colors shrink-0">
          ← Volver
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-accent/70">Pre-Sample Studio</span>
            <span className="text-[10px] font-mono text-text-20">·</span>
            <span className="text-[10px] font-mono text-text-30">{data.market?.country} · {data.market?.language}</span>
          </div>
          <h2 className="font-display text-2xl text-text-100 truncate">{productTitle ?? 'Pre-Sample Studio'}</h2>
          <p className="text-xs text-text-40 mt-1">{data.goal}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportJSON}
            className="px-3 py-1.5 rounded-lg border border-border-soft bg-bg-1/60 text-xs text-text-60 hover:text-text-80 hover:border-border-mid transition-colors"
          >
            JSON
          </button>
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 rounded-lg border border-border-soft bg-bg-1/60 text-xs text-text-60 hover:text-text-80 hover:border-border-mid transition-colors"
          >
            CSV
          </button>
        </div>
      </div>

      {/* ── 1. Dirección de marca ── */}
      <div>
        <SectionHeader id="brand" title="Dirección de marca" collapsed={isCollapsed('brand')} onToggle={() => toggleSection('brand')} />
        {!isCollapsed('brand') && data.brandDirection && (
          <div className="mt-2 rounded-xl border border-border-soft bg-bg-1/30 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              {[
                ['Estilo de marca', data.brandDirection.brandStyle],
                ['Percepción deseada', data.brandDirection.desiredPerception],
                ['Promesa principal', data.brandDirection.mainPromise],
                ['Tipo de cliente', data.brandDirection.customerType],
                ['Tono de comunicación', data.brandDirection.tone],
              ].map(([label, val]) => val ? (
                <div key={label}>
                  <span className="text-[10px] text-text-30 uppercase tracking-widest block mb-0.5">{label}</span>
                  <p className="text-sm text-text-80">{val}</p>
                </div>
              ) : null)}
            </div>
            <div className="space-y-3">
              {data.brandDirection.wordsToUse?.length > 0 && (
                <div>
                  <span className="text-[10px] text-score-green/60 uppercase tracking-widest block mb-1.5">Palabras a usar</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.brandDirection.wordsToUse.map(w => <Chip key={w} text={w} color="#4ADE80" />)}
                  </div>
                </div>
              )}
              {data.brandDirection.wordsToAvoid?.length > 0 && (
                <div>
                  <span className="text-[10px] text-score-red/60 uppercase tracking-widest block mb-1.5">Palabras a evitar</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.brandDirection.wordsToAvoid.map(w => <Chip key={w} text={w} color="#F87171" />)}
                  </div>
                </div>
              )}
              {data.brandDirection.visualKeywords?.length > 0 && (
                <div>
                  <span className="text-[10px] text-text-30 uppercase tracking-widest block mb-1.5">Palabras visuales clave</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.brandDirection.visualKeywords.map(w => <Chip key={w} text={w} color="#B8FF5C" />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Paletas de color ── */}
      <div>
        <SectionHeader id="palettes" title="Paletas de color" count={data.colorPalettes?.length} collapsed={isCollapsed('palettes')} onToggle={() => toggleSection('palettes')} />
        {!isCollapsed('palettes') && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(data.colorPalettes ?? []).map((p, i) => (
              <div key={i} className="rounded-xl border border-border-soft bg-bg-1/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-80">{p.name}</span>
                  <CopyBtn
                    text={`primary: ${p.primary}\nsecondary: ${p.secondary}\nbackground: ${p.background}\naccent: ${p.accent}\ntext: ${p.text}`}
                    id={`pal-${i}`}
                    label="Copiar"
                  />
                </div>
                {/* Swatches row */}
                <div className="flex items-center gap-2">
                  {[p.background, p.primary, p.secondary, p.accent, p.text].map((hex, j) => (
                    <div key={j} className="flex flex-col items-center gap-1">
                      <ColorSwatch hex={hex ?? '#333'} size={28} />
                      <span className="text-[9px] font-mono text-text-20">{hex ?? ''}</span>
                    </div>
                  ))}
                </div>
                {/* Big preview bar */}
                <div className="h-2 rounded-full overflow-hidden flex">
                  {[p.primary, p.secondary, p.accent].filter(isValidHex).map((hex, j) => (
                    <div key={j} className="flex-1" style={{ background: hex }} />
                  ))}
                </div>
                {p.useCase && <p className="text-[11px] text-text-40 italic">{p.useCase}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Estilo visual ── */}
      <div>
        <SectionHeader id="style" title="Estilo visual y gráfico" collapsed={isCollapsed('style')} onToggle={() => toggleSection('style')} />
        {!isCollapsed('style') && data.graphicStyle && (
          <div className="mt-2 rounded-xl border border-border-soft bg-bg-1/30 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              {[
                ['Tipografía', data.graphicStyle.typographyDirection],
                ['Layout', data.graphicStyle.layoutStyle],
                ['Fotografía', data.graphicStyle.photoStyle],
                ['Iconografía', data.graphicStyle.iconStyle],
              ].map(([label, val]) => val ? (
                <div key={label}>
                  <span className="text-[10px] text-text-30 uppercase tracking-widest block mb-0.5">{label}</span>
                  <p className="text-xs text-text-70">{val}</p>
                </div>
              ) : null)}
            </div>
            {data.graphicStyle.designRules?.length > 0 && (
              <div>
                <span className="text-[10px] text-text-30 uppercase tracking-widest block mb-2">Reglas de diseño</span>
                <ul className="space-y-2">
                  {data.graphicStyle.designRules.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-60">
                      <span className="text-accent shrink-0">·</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Prompts de imágenes ── */}
      <div>
        <SectionHeader id="prompts" title="Prompts de imágenes IA" count={data.imagePrompts?.length} collapsed={isCollapsed('prompts')} onToggle={() => toggleSection('prompts')} />
        {!isCollapsed('prompts') && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data.imagePrompts ?? []).map(p => <PromptCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* ── 5. Creativos estáticos ── */}
      <div>
        <SectionHeader
          id="creatives"
          title="Creativos estáticos"
          count={activeCreatives.length}
          collapsed={isCollapsed('creatives')}
          onToggle={() => toggleSection('creatives')}
        />
        {!isCollapsed('creatives') && (
          <div className="mt-2 space-y-4">
            {favCreatives.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[10px] font-mono text-score-yellow/60 uppercase tracking-widest">★ Favoritos</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {favCreatives.map(c => <CreativeCard key={c.id} c={c} />)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {restCreatives.map(c => <CreativeCard key={c.id} c={c} />)}
            </div>
            {activeCreatives.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={exportCSV}
                  className="px-4 py-2 rounded-lg border border-border-soft text-xs text-text-60 hover:text-text-80 hover:border-border-mid transition-colors"
                >
                  Exportar {activeCreatives.length} creativos → CSV
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 6. Carruseles ── */}
      <div>
        <SectionHeader id="carousels" title="Carruseles" count={data.carousels?.length} collapsed={isCollapsed('carousels')} onToggle={() => toggleSection('carousels')} />
        {!isCollapsed('carousels') && (
          <div className="mt-2 space-y-3">
            {(data.carousels ?? []).map(c => {
              const text = `${c.title}\nObjetivo: ${c.objective}\n\n${c.slides.map(s => `Slide ${s.slide}: ${s.text}\nVisual: ${s.visualSuggestion}`).join('\n\n')}\n\nCTA: ${c.ctaFinal}`;
              return (
                <div key={c.id} className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-sm font-medium text-text-80">{c.title}</span>
                      {c.objective && <p className="text-xs text-text-40 mt-0.5 italic">{c.objective}</p>}
                    </div>
                    <CopyBtn text={text} id={`car-${c.id}`} label="Copiar" />
                  </div>
                  <div className="space-y-2">
                    {(c.slides ?? []).map(s => (
                      <div key={s.slide} className="flex gap-3 items-start">
                        <span className="text-[10px] font-mono text-text-30 w-12 shrink-0 mt-0.5">S{s.slide}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-80">{s.text}</p>
                          {s.visualSuggestion && (
                            <p className="text-[11px] text-text-30 mt-0.5 italic">{s.visualSuggestion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {c.ctaFinal && (
                    <div className="mt-3 pt-3 border-t border-border-soft flex items-center gap-2">
                      <span className="text-[10px] text-text-30 uppercase tracking-widest">CTA final</span>
                      <span className="text-xs font-medium text-accent">{c.ctaFinal}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 7. Estructura de tienda ── */}
      <div>
        <SectionHeader id="store" title="Estructura de tienda" collapsed={isCollapsed('store')} onToggle={() => toggleSection('store')} />
        {!isCollapsed('store') && data.storeStructure && (
          <div className="mt-2 space-y-3">
            {/* Hero block */}
            <div className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-text-30 uppercase tracking-widest">Hero</span>
                {data.storeStructure.platformSuggestion && (
                  <Chip text={`Plataforma: ${data.storeStructure.platformSuggestion}`} />
                )}
              </div>
              <p className="text-base font-medium text-text-100 mb-1">{data.storeStructure.heroHeadline}</p>
              <p className="text-sm text-text-60 mb-3">{data.storeStructure.heroSubheadline}</p>
              <div className="flex items-center justify-between">
                <span
                  className="px-4 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(184,255,92,0.15)', color: '#B8FF5C', border: '1px solid rgba(184,255,92,0.25)' }}
                >
                  {data.storeStructure.primaryCTA}
                </span>
                <CopyBtn
                  text={`${data.storeStructure.heroHeadline}\n${data.storeStructure.heroSubheadline}\nCTA: ${data.storeStructure.primaryCTA}`}
                  id="hero-copy"
                  label="Copiar hero"
                />
              </div>
            </div>

            {/* Benefits */}
            {data.storeStructure.benefitBullets?.length > 0 && (
              <div className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
                <span className="text-[10px] text-text-30 uppercase tracking-widest block mb-2">Beneficios</span>
                <ul className="space-y-1.5">
                  {data.storeStructure.benefitBullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-text-70">
                      <span className="text-accent">·</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.storeStructure.productDescriptionShort && (
                <div className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-text-30 uppercase tracking-widest">Descripción corta</span>
                    <CopyBtn text={data.storeStructure.productDescriptionShort} id="desc-short" label="Copiar" />
                  </div>
                  <p className="text-xs text-text-70 leading-relaxed">{data.storeStructure.productDescriptionShort}</p>
                </div>
              )}
              {data.storeStructure.productDescriptionLong && (
                <div className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-text-30 uppercase tracking-widest">Descripción larga</span>
                    <CopyBtn text={data.storeStructure.productDescriptionLong} id="desc-long" label="Copiar" />
                  </div>
                  <p className="text-xs text-text-70 leading-relaxed">
                    {expandedDesc
                      ? data.storeStructure.productDescriptionLong
                      : data.storeStructure.productDescriptionLong.slice(0, 180) + (data.storeStructure.productDescriptionLong.length > 180 ? '…' : '')}
                  </p>
                  {data.storeStructure.productDescriptionLong.length > 180 && (
                    <button onClick={() => setExpandedDesc(e => !e)} className="text-[11px] text-accent/60 hover:text-accent mt-1">
                      {expandedDesc ? 'Ver menos' : 'Ver completa'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Sections */}
            {data.storeStructure.sections?.length > 0 && (
              <div className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-text-30 uppercase tracking-widest">Secciones</span>
                  <button onClick={() => setExpandedStore(e => !e)} className="text-xs text-text-40 hover:text-text-60">
                    {expandedStore ? 'Colapsar' : 'Ver todas'}
                  </button>
                </div>
                <div className="space-y-3">
                  {(expandedStore ? data.storeStructure.sections : data.storeStructure.sections.slice(0, 2)).map((sec, i) => (
                    <div key={i} className="border-l-2 border-border-mid pl-3">
                      <span className="text-xs font-medium text-text-80">{sec.name}</span>
                      {sec.goal && <p className="text-[11px] text-text-40 mt-0.5 italic">{sec.goal}</p>}
                      {sec.copy && <p className="text-xs text-text-60 mt-1">{sec.copy}</p>}
                      {sec.visualNeeded && (
                        <p className="text-[11px] text-accent/50 mt-0.5">Visual: {sec.visualNeeded}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQs */}
            {data.storeStructure.faqs?.length > 0 && (
              <div className="rounded-xl border border-border-soft bg-bg-1/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-text-30 uppercase tracking-widest">FAQs ({data.storeStructure.faqs.length})</span>
                  <CopyBtn
                    text={data.storeStructure.faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}
                    id="faqs-all"
                    label="Copiar todas"
                  />
                </div>
                <div className="space-y-1">
                  {data.storeStructure.faqs.map((faq, i) => (
                    <div key={i} className="border-b border-border-soft last:border-0">
                      <button
                        onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                        className="w-full flex items-center justify-between py-2.5 text-left"
                      >
                        <span className="text-xs text-text-80">{faq.question}</span>
                        <span className="text-text-30 text-xs ml-2 shrink-0">{activeFaq === i ? '−' : '+'}</span>
                      </button>
                      {activeFaq === i && faq.answer && (
                        <p className="text-xs text-text-50 pb-2.5 leading-relaxed">{faq.answer}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 8. Shot list ── */}
      <div>
        <SectionHeader id="shots" title="Shot list — cuando llegue la muestra" count={data.sampleArrivalShotList?.length} collapsed={isCollapsed('shots')} onToggle={() => toggleSection('shots')} />
        {!isCollapsed('shots') && (
          <div className="mt-2 rounded-xl border border-border-soft bg-bg-1/30 p-4">
            <div className="flex justify-end mb-3">
              <button
                onClick={exportShotListText}
                className="text-xs text-text-40 hover:text-text-60 border border-border-soft px-3 py-1 rounded-lg transition-colors"
              >
                {copied === 'shot-list-all' ? '✓ Copiada' : 'Copiar shot list'}
              </button>
            </div>
            <div className="space-y-3">
              {(data.sampleArrivalShotList ?? []).map((s, i) => (
                <div key={s.id} className="flex gap-3 items-start pb-3 border-b border-border-soft last:border-0 last:pb-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-mono"
                    style={{ background: 'rgba(184,255,92,0.1)', color: '#B8FF5C', border: '1px solid rgba(184,255,92,0.2)' }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text-80">{s.shot}</span>
                      <PriorityBadge p={s.priority} />
                    </div>
                    {s.purpose && <p className="text-xs text-text-50 mb-1">Para: {s.purpose}</p>}
                    {s.howToFilm && (
                      <p className="text-xs text-text-40 italic">
                        <span className="not-italic text-text-30">Cómo: </span>{s.howToFilm}
                      </p>
                    )}
                    {s.creativeAngle && (
                      <p className="text-[11px] text-accent/50 mt-1">Ángulo: {s.creativeAngle}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Próximos pasos ── */}
      <div>
        <SectionHeader id="next" title="Próximos pasos" count={data.nextActions?.length} collapsed={isCollapsed('next')} onToggle={() => toggleSection('next')} />
        {!isCollapsed('next') && data.nextActions?.length > 0 && (
          <div className="mt-2 rounded-xl border border-border-soft bg-bg-1/30 p-4 space-y-3">
            {data.nextActions.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-mono font-bold mt-0.5"
                  style={{ background: 'rgba(184,255,92,0.12)', color: '#B8FF5C', border: '1px solid rgba(184,255,92,0.25)' }}
                >
                  {i + 1}
                </div>
                <p className="text-sm text-text-70 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom actions ── */}
      <div className="flex gap-3 flex-wrap pt-2">
        <button
          onClick={exportJSON}
          className="flex-1 py-3 rounded-xl border border-border-soft bg-bg-2 text-sm text-text-60 hover:text-text-80 hover:border-border-mid transition-colors"
        >
          Exportar JSON completo
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-border-soft bg-bg-2 text-sm text-text-60 hover:text-text-80 hover:border-border-mid transition-colors"
        >
          ← Volver al análisis
        </button>
      </div>
    </div>
  );
}
