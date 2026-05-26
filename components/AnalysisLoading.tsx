'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  'Verificando margen en el servidor',
  'Consultando Google Trends',
  'Midiendo competencia en Mercado Libre',
  'Analizando con IA las 9 dimensiones',
  'Calculando score y veredicto',
];

export default function AnalysisLoading() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setActive(i), i * 1400),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="animate-fade-up rounded-2xl border border-border-soft bg-bg-1/80 p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-2.5 h-2.5 rounded-full bg-accent"
          style={{ animation: 'pulse-ring 1.5s infinite' }}
        />
        <span className="font-display text-lg">Analizando producto</span>
      </div>
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-all"
              style={{
                background: i < active ? '#B8FF5C' : i === active ? 'rgba(184,255,92,0.2)' : '#1D1D22',
                color: i < active ? '#0A0A0B' : '#fff',
                border: i === active ? '1px solid #B8FF5C' : '1px solid transparent',
              }}
            >
              {i < active ? '✓' : i + 1}
            </div>
            <span
              className="text-sm transition-colors"
              style={{ color: i <= active ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.36)' }}
            >
              {step}
            </span>
            {i === active && (
              <div className="flex-1 h-px bg-gradient-to-r from-accent/40 to-transparent" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
