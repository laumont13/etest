'use client';

import { useState, useEffect, useCallback } from 'react';
import MarginGate, { type MarginValues } from '@/components/MarginGate';
import ResultCard, { type RankInfo } from '@/components/ResultCard';
import AnalysisLoading from '@/components/AnalysisLoading';
import ExportPdfButton from '@/components/ExportPdfButton';
import HistoryPanel from '@/components/HistoryPanel';
import BattleView from '@/components/BattleView';
import PreSampleStudioView, { type PreSampleData } from '@/components/PreSampleStudioView';
import { COUNTRY_LIST } from '@/lib/countries';
import { evaluateMargin } from '@/lib/scoring';
import {
  loadHistory,
  addToHistory,
  setItemStatus,
  removeItem,
  clearHistory,
  getRanked,
  itemScore,
  type HistoryItem,
  type HistoryStatus,
} from '@/lib/history';
import type { BattleResult } from '@/lib/gemini';

type Phase =
  | 'input'
  | 'loading'
  | 'result'
  | 'gate-failed'
  | 'battle-loading'
  | 'battle-result'
  | 'pre-sample-loading'
  | 'pre-sample';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'etest_session';
  let id = '';
  try {
    id = window.sessionStorage.getItem(key) ?? '';
    if (!id) {
      id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem(key, id);
    }
  } catch {
    id = `s_${Date.now()}`;
  }
  return id;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('input');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('AR');
  const [margin, setMargin] = useState<MarginValues>({
    unitCost: '',
    shippingCost: '',
    fees: '',
    sellPrice: '',
  });
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('server');

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewingItem, setViewingItem] = useState<HistoryItem | null>(null);
  const [selectedForBattle, setSelectedForBattle] = useState<string[]>([]);
  const [battleA, setBattleA] = useState<HistoryItem | null>(null);
  const [battleB, setBattleB] = useState<HistoryItem | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [preSampleData, setPreSampleData] = useState<PreSampleData | null>(null);
  const [preSampleError, setPreSampleError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
    setHistory(loadHistory());
  }, []);

  const gate = evaluateMargin({
    unitCost: parseFloat(margin.unitCost) || 0,
    shippingCost: parseFloat(margin.shippingCost) || 0,
    fees: parseFloat(margin.fees) || 0,
    sellPrice: parseFloat(margin.sellPrice) || 0,
  });

  const canAnalyze = title.trim().length >= 2 && gate.passesGate;
  const hasHistory = history.length > 0;

  // Rank info for the current result
  const rankInfo: RankInfo | null = (() => {
    if (!lastAddedId || viewingItem) return null;
    const ranked = getRanked(history);
    const idx = ranked.findIndex(h => h.id === lastAddedId);
    if (idx === -1) return null;
    const position = idx + 1;
    const total = ranked.length;
    const isNewLeader = position === 1 && total > 1;
    const leaderScore = total > 0 ? itemScore(ranked[0]) : null;
    const myScore = itemScore(ranked[idx]);
    const scoreDelta = position > 1 && leaderScore !== null ? myScore - leaderScore : null;
    const leaderTitle = position > 1 ? (ranked[0]?.data?.product?.title ?? null) : null;
    return { position, total, isNewLeader, scoreDelta, leaderTitle };
  })();

  // The leader ID to highlight in HistoryPanel when a new leader arrives
  const newLeaderId = (() => {
    if (!lastAddedId) return null;
    const ranked = getRanked(history);
    return ranked[0]?.id === lastAddedId && ranked.length > 1 ? lastAddedId : null;
  })();

  const extractMeta = useCallback(async () => {
    if (!url.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
    } catch {
      // silencioso
    } finally {
      setExtracting(false);
    }
  }, [url]);

  const analyze = useCallback(async () => {
    setError(null);
    setViewingItem(null);
    setLastAddedId(null);
    setPhase('loading');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          sourceUrl: url.trim() || null,
          country,
          sessionId,
          margin: {
            unitCost: parseFloat(margin.unitCost) || 0,
            shippingCost: parseFloat(margin.shippingCost) || 0,
            fees: parseFloat(margin.fees) || 0,
            sellPrice: parseFloat(margin.sellPrice) || 0,
          },
        }),
      });
      const data = await res.json();
      if (data.gateFailed) {
        setResult(data);
        setPhase('gate-failed');
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Error en el análisis.');
        setPhase('input');
        return;
      }
      setResult(data);
      const updated = addToHistory(data);
      const newItem = updated[0]; // always the most recently added
      setLastAddedId(newItem.id);
      setHistory(updated);
      setPhase('result');
    } catch {
      setError('No se pudo conectar. Reintentá.');
      setPhase('input');
    }
  }, [title, description, url, country, sessionId, margin]);

  const reset = () => {
    setPhase('input');
    setResult(null);
    setError(null);
    setViewingItem(null);
    setLastAddedId(null);
  };

  const handleViewItem = (item: HistoryItem) => {
    setViewingItem(item);
    setResult(null);
    setLastAddedId(null);
    setPhase('result');
    setHistoryOpen(false);
  };

  const handleStatusChange = (id: string, status: HistoryStatus) => {
    setHistory(setItemStatus(id, status));
  };

  const handleRemove = (id: string) => {
    setHistory(removeItem(id));
  };

  const handleToggleBattle = (id: string) => {
    setSelectedForBattle(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleStartBattle = async () => {
    if (selectedForBattle.length < 2) return;
    const a = history.find(h => h.id === selectedForBattle[0]);
    const b = history.find(h => h.id === selectedForBattle[1]);
    if (!a || !b) return;

    setBattleA(a);
    setBattleB(b);
    setBattleResult(null);
    setPhase('battle-loading');
    setHistoryOpen(false);

    try {
      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productA: a.data, productB: b.data }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error en la batalla');
      setBattleResult(data);
      setPhase('battle-result');
    } catch {
      setError('Error en la comparación IA. Reintentá.');
      setPhase('input');
    }
  };

  const openPreSample = async () => {
    if (!displayData) return;
    setPreSampleError(null);
    setPhase('pre-sample-loading');
    try {
      const res = await fetch('/api/pre-sample-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(displayData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setPreSampleData(data);
      setPhase('pre-sample');
    } catch {
      setPreSampleError('No se pudo generar el Pre-Sample Studio. Reintentá.');
      setPhase('result');
    }
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
    setSelectedForBattle([]);
    setLastAddedId(null);
  };

  const displayData = viewingItem ? viewingItem.data : result;

  // Command center sidebar: always visible when there's history (except during initial analysis loading)
  const showSidebar = hasHistory && phase !== 'loading' && phase !== 'pre-sample-loading';

  const historyPanel = (
    <HistoryPanel
      history={history}
      selectedForBattle={selectedForBattle}
      newLeaderId={newLeaderId}
      onView={handleViewItem}
      onStatusChange={handleStatusChange}
      onRemove={handleRemove}
      onToggleBattle={handleToggleBattle}
      onStartBattle={handleStartBattle}
      onClear={handleClearHistory}
    />
  );

  return (
    <main className="min-h-screen">
      <div
        className={`mx-auto px-4 sm:px-6 py-10 sm:py-16 transition-all ${
          showSidebar ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        <div className={`flex gap-8 ${showSidebar ? 'lg:flex-row flex-col' : ''}`}>

          {/* ─── Main column ─── */}
          <div className="flex-1 min-w-0">

            {/* Header */}
            <header className="mb-10 sm:mb-14">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-xs uppercase tracking-[0.14em] font-mono text-text-60">
                    E-Test
                  </span>
                </div>
                {/* Mobile command center toggle */}
                {hasHistory && (
                  <button
                    onClick={() => setHistoryOpen(o => !o)}
                    className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors"
                    style={{
                      borderColor: historyOpen ? 'rgba(184,255,92,0.35)' : 'rgba(255,255,255,0.1)',
                      color: historyOpen ? '#B8FF5C' : 'rgba(255,255,255,0.56)',
                      background: historyOpen ? 'rgba(184,255,92,0.06)' : 'transparent',
                    }}
                  >
                    ⚡ Ranking ({history.filter(h => h.status !== 'discarded').length})
                  </button>
                )}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] text-text-100 mb-3">
                Validá productos antes
                <br />
                de <span className="text-accent">importarlos</span>.
              </h1>
              <p className="text-text-60 max-w-lg leading-relaxed">
                El margen filtra primero —gratis e instantáneo—. Solo los productos que pasan llegan al
                análisis profundo con IA, señales reales de mercado y veredicto accionable.
              </p>
            </header>

            {/* Mobile command center panel */}
            {hasHistory && historyOpen && (
              <div className="lg:hidden mb-6 rounded-2xl border border-border-soft bg-bg-1/80 p-4">
                {historyPanel}
              </div>
            )}

            {/* Input phase */}
            {phase === 'input' && (
              <div className="space-y-5 animate-fade-up">
                <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-5 sm:p-6">
                  <label className="text-xs uppercase tracking-[0.14em] text-text-60 font-mono block mb-2">
                    Link de Alibaba / AliExpress (opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.alibaba.com/product-detail/..."
                      className="flex-1 bg-bg-2 border border-border-mid rounded-lg px-3 py-2.5 text-text-100 text-sm
                                 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors
                                 placeholder:text-text-20"
                    />
                    <button
                      onClick={extractMeta}
                      disabled={!url.trim() || extracting}
                      className="px-4 py-2.5 rounded-lg bg-bg-3 border border-border-mid text-sm text-text-80
                                 hover:border-accent/40 hover:text-text-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {extracting ? 'Leyendo…' : 'Leer'}
                    </button>
                  </div>

                  <div className="mt-4">
                    <label className="text-xs uppercase tracking-[0.14em] text-text-60 font-mono block mb-2">
                      Producto *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: Lámpara LED de escritorio plegable"
                      className="w-full bg-bg-2 border border-border-mid rounded-lg px-3 py-2.5 text-text-100 text-sm
                                 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors
                                 placeholder:text-text-20"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="text-xs uppercase tracking-[0.14em] text-text-60 font-mono block mb-2">
                      País objetivo
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COUNTRY_LIST.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCountry(c.code)}
                          className="px-3 py-1.5 rounded-lg text-sm border transition-colors"
                          style={{
                            borderColor: country === c.code ? 'rgba(184,255,92,0.5)' : 'rgba(255,255,255,0.1)',
                            background: country === c.code ? 'rgba(184,255,92,0.1)' : 'transparent',
                            color: country === c.code ? '#B8FF5C' : 'rgba(255,255,255,0.56)',
                          }}
                        >
                          {c.flag} {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <MarginGate values={margin} onChange={setMargin} />

                {error && (
                  <div className="rounded-lg border border-score-red/30 bg-score-red/10 px-4 py-3 text-sm text-score-red">
                    {error}
                  </div>
                )}

                <button
                  onClick={analyze}
                  disabled={!canAnalyze}
                  className="w-full py-4 rounded-xl font-medium text-base transition-all disabled:cursor-not-allowed"
                  style={{
                    background: canAnalyze ? '#B8FF5C' : '#1D1D22',
                    color: canAnalyze ? '#0A0A0B' : 'rgba(255,255,255,0.36)',
                  }}
                >
                  {!title.trim()
                    ? 'Completá el producto'
                    : !gate.passesGate
                      ? 'No pasa el gate de margen'
                      : 'Analizar producto →'}
                </button>
                {!gate.passesGate && title.trim() && (margin.unitCost || margin.sellPrice) && (
                  <p className="text-center text-xs text-text-40">
                    Ajustá el precio o el costo para superar el mínimo de 3x antes de gastar análisis.
                  </p>
                )}
              </div>
            )}

            {/* Loading */}
            {phase === 'loading' && <AnalysisLoading />}

            {/* Result */}
            {phase === 'result' && displayData && (
              <div className="space-y-6">
                {viewingItem && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={reset}
                      className="text-sm text-text-40 hover:text-text-80 transition-colors flex items-center gap-1.5"
                    >
                      ← Nuevo análisis
                    </button>
                    <span className="text-text-20">·</span>
                    <span className="text-xs font-mono text-text-30">
                      Desde historial
                    </span>
                  </div>
                )}
                <ResultCard
                  data={displayData}
                  rankInfo={rankInfo}
                  onBattle={() => setHistoryOpen(true)}
                />
                {preSampleError && (
                  <div className="rounded-lg border border-score-red/30 bg-score-red/10 px-4 py-3 text-sm text-score-red">
                    {preSampleError}
                  </div>
                )}
                <button
                  onClick={openPreSample}
                  className="w-full py-3.5 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    background: 'rgba(184,255,92,0.06)',
                    borderColor: 'rgba(184,255,92,0.25)',
                    color: '#B8FF5C',
                  }}
                >
                  ✦ Crear Pre-Sample Studio
                </button>
                <div className="flex gap-3 flex-wrap">
                  <ExportPdfButton data={displayData} />
                  <button
                    onClick={reset}
                    className="flex-1 py-3 rounded-xl bg-bg-2 border border-border-mid text-text-80 hover:text-text-100 hover:border-accent/40 transition-colors"
                  >
                    Validar otro producto
                  </button>
                </div>
              </div>
            )}

            {/* Pre-Sample loading */}
            {phase === 'pre-sample-loading' && (
              <div className="animate-fade-up flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <p className="text-text-60 text-sm">Generando Pre-Sample Studio…</p>
                <p className="text-text-30 text-xs max-w-xs text-center">Creando identidad de marca, paletas, prompts y creativos. Puede tomar hasta 30 segundos.</p>
              </div>
            )}

            {/* Pre-Sample Studio result */}
            {phase === 'pre-sample' && preSampleData && (
              <PreSampleStudioView
                data={preSampleData}
                productTitle={displayData?.product?.title}
                onBack={() => setPhase('result')}
              />
            )}

            {/* Battle */}
            {(phase === 'battle-loading' || phase === 'battle-result') && battleA && battleB && (
              <BattleView
                itemA={battleA}
                itemB={battleB}
                result={battleResult}
                loading={phase === 'battle-loading'}
                onBack={() => {
                  setPhase('input');
                  setSelectedForBattle([]);
                }}
              />
            )}

            {/* Gate failed */}
            {phase === 'gate-failed' && result && (
              <div className="animate-fade-up rounded-2xl border border-score-red/30 bg-score-red/10 p-6 sm:p-8">
                <div className="text-score-red text-xs uppercase tracking-[0.14em] font-mono mb-3">
                  ✕ No pasa el gate
                </div>
                <h2 className="font-display text-2xl mb-3">{title}</h2>
                <p className="text-text-80 mb-5">{result.message}</p>
                <button
                  onClick={reset}
                  className="px-5 py-2.5 rounded-lg bg-bg-2 border border-border-mid text-text-80 hover:text-text-100 transition-colors"
                >
                  Probar otro producto
                </button>
              </div>
            )}

            <footer className="mt-16 pt-6 border-t border-border-soft">
              <p className="text-xs text-text-40 leading-relaxed">
                E-Test es una herramienta de asistencia a la decisión, no un oráculo. Filtra rápido lo
                malo; la validación final siempre se hace con público real, anuncios y métricas. La IA no
                inventa cifras: marca los datos que faltan.
              </p>
            </footer>
          </div>

          {/* ─── Desktop command center ─── */}
          {showSidebar && (
            <div className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-8">
                <div className="rounded-2xl border border-border-soft bg-bg-1/80 p-4">
                  {historyPanel}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
