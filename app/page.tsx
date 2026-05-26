'use client';

import { useState, useEffect, useCallback } from 'react';
import MarginGate, { type MarginValues } from '@/components/MarginGate';
import ResultCard from '@/components/ResultCard';
import AnalysisLoading from '@/components/AnalysisLoading';
import ExportPdfButton from '@/components/ExportPdfButton';
import { COUNTRY_LIST } from '@/lib/countries';
import { evaluateMargin } from '@/lib/scoring';

type Phase = 'input' | 'loading' | 'result' | 'gate-failed';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'etest_session';
  let id = '';
  try {
    // sessionStorage: historial por sesión, sin login
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

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const gate = evaluateMargin({
    unitCost: parseFloat(margin.unitCost) || 0,
    shippingCost: parseFloat(margin.shippingCost) || 0,
    fees: parseFloat(margin.fees) || 0,
    sellPrice: parseFloat(margin.sellPrice) || 0,
  });

  const canAnalyze = title.trim().length >= 2 && gate.passesGate;

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
      // silencioso: el usuario completa a mano
    } finally {
      setExtracting(false);
    }
  }, [url]);

  const analyze = useCallback(async () => {
    setError(null);
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
      setPhase('result');
    } catch (e) {
      setError('No se pudo conectar. Reintentá.');
      setPhase('input');
    }
  }, [title, description, url, country, sessionId, margin]);

  const reset = () => {
    setPhase('input');
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Header */}
      <header className="mb-10 sm:mb-14">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-xs uppercase tracking-[0.14em] font-mono text-text-60">
            E-Test
          </span>
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

      {phase === 'input' && (
        <div className="space-y-5 animate-fade-up">
          {/* Input de URL */}
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

          {/* Gate de margen */}
          <MarginGate values={margin} onChange={setMargin} />

          {error && (
            <div className="rounded-lg border border-score-red/30 bg-score-red/10 px-4 py-3 text-sm text-score-red">
              {error}
            </div>
          )}

          {/* CTA */}
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

      {phase === 'loading' && <AnalysisLoading />}

      {phase === 'result' && result && (
        <div className="space-y-6">
          <ResultCard data={result} />
          <div className="flex gap-3">
            <ExportPdfButton data={result} />
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl bg-bg-2 border border-border-mid text-text-80 hover:text-text-100 hover:border-accent/40 transition-colors"
            >
              Validar otro producto
            </button>
          </div>
        </div>
      )}

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
    </main>
  );
}
