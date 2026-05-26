'use client';

import { useState } from 'react';

/**
 * Botón que envía el payload del análisis a /api/export-pdf y dispara la
 * descarga del binario PDF. El usuario inicia la acción con el click, así que
 * la descarga es explícita.
 */
export default function ExportPdfButton({ data }: { data: unknown }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleExport() {
    setState('loading');
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Nombre de archivo desde el header, con fallback.
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'etest-analisis.pdf';

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setState('idle');
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2500);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={state === 'loading'}
      className="flex-1 py-3 rounded-xl bg-bg-2 border border-border-mid text-text-80
                 hover:text-text-100 hover:border-accent/40 transition-colors
                 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {state === 'loading' ? (
        <>
          <span
            className="w-3.5 h-3.5 rounded-full border-2 border-text-40 border-t-accent inline-block"
            style={{ animation: 'spin 0.7s linear infinite' }}
          />
          Generando PDF…
        </>
      ) : state === 'error' ? (
        <span className="text-score-red">Error — reintentá</span>
      ) : (
        <>↓ Descargar PDF</>
      )}
    </button>
  );
}
