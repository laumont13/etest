'use client';

import { useMemo, useState } from 'react';
import { evaluateMargin, MIN_MARGIN_MULTIPLE, HEALTHY_MARGIN_MULTIPLE } from '@/lib/scoring';

export interface MarginValues {
  unitCost: string;
  shippingCost: string;
  fees: string;
  sellPrice: string;
}

interface Props {
  values: MarginValues;
  onChange: (v: MarginValues) => void;
}

export default function MarginGate({ values, onChange }: Props) {
  const [showGuide, setShowGuide] = useState(false);

  const result = useMemo(() => {
    const n = (s: string) => {
      const v = parseFloat(s);
      return Number.isFinite(v) ? v : 0;
    };
    return evaluateMargin({
      unitCost: n(values.unitCost),
      shippingCost: n(values.shippingCost),
      fees: n(values.fees),
      sellPrice: n(values.sellPrice),
    });
  }, [values]);

  const hasData = values.unitCost && values.sellPrice;
  const pct = Math.min(100, (result.multiple / HEALTHY_MARGIN_MULTIPLE) * 100);

  const field = (
    key: keyof MarginValues,
    label: string,
    placeholder: string,
    helper?: string,
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-[0.14em] text-text-60 font-mono">
        {label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={values[key]}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...values, [key]: e.target.value })}
        className="bg-bg-2 border border-border-mid rounded-lg px-3 py-2.5 text-text-100 font-mono text-sm
                   focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors
                   placeholder:text-text-20"
      />
      {helper && (
        <p className="text-[10px] text-text-30 leading-snug">{helper}</p>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-border-soft bg-bg-1/80 backdrop-blur p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-display text-lg text-text-100">Costos y margen</h3>
        <span className="text-[11px] uppercase tracking-[0.14em] font-mono text-text-40">
          Filtro 1 · instantáneo
        </span>
      </div>

      {/* Guide box */}
      <div
        className="rounded-xl mb-4 p-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-mono text-text-60 font-medium">¿Qué tengo que poner acá?</span>
          <button
            onClick={() => setShowGuide(g => !g)}
            className="text-[10px] font-mono text-text-30 hover:text-text-60 transition-colors shrink-0"
          >
            {showGuide ? 'Ocultar' : 'Ver ejemplo'}
          </button>
        </div>
        <p className="text-[11px] text-text-40 leading-snug">
          Cargá una estimación simple. No hace falta que sea perfecta. La app usa estos datos
          para calcular si queda margen real después de costos, transporte, impuestos y comisiones.
        </p>
        {showGuide && (
          <div className="mt-3 pt-3 border-t border-border-soft space-y-1 font-mono text-[11px]">
            <div className="flex gap-2">
              <span className="text-text-30 w-32 shrink-0">Costo producto</span>
              <span className="text-text-60">USD 7</span>
            </div>
            <div className="flex gap-2">
              <span className="text-text-30 w-32 shrink-0">Transp. e imp.</span>
              <span className="text-text-60">USD 5 (flete + aduana estimados)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-text-30 w-32 shrink-0">Comisiones</span>
              <span className="text-text-60">USD 3 (15% de $35 aprox.)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-text-30 w-32 shrink-0">Precio de venta</span>
              <span className="text-text-60">USD 35</span>
            </div>
            <p className="text-text-30 mt-2 text-[10px] font-sans leading-snug">
              La app no mira solo si el producto es barato. Mira si todavía queda ganancia después de todos los costos.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {field(
          'unitCost',
          'Costo del producto',
          'Ej: 7',
          'Lo que te cobra el proveedor por cada unidad (en USD).',
        )}
        {field(
          'shippingCost',
          'Transporte e impuestos',
          'Ej: 5',
          'Flete, courier, aduana, IVA, aranceles. Estimá si no sabés exacto.',
        )}
        {field(
          'fees',
          'Comisiones de venta',
          'Ej: 3',
          'En USD. ML, Shopify, pasarela, envío gratis. Ej: 15% de $35 = $5.',
        )}
        {field(
          'sellPrice',
          'Precio de venta',
          'Ej: 45',
          'Precio final al que creés que podés vender al cliente.',
        )}
      </div>

      {hasData ? (
        <div className="animate-scale-in">
          {/* Barra de múltiplo */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-text-60">Múltiplo precio/costo</span>
            <span
              className="font-display text-2xl tabular-nums"
              style={{ color: result.passesGate ? '#B8FF5C' : '#F87171' }}
            >
              {result.multiple}x
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-bg-3 overflow-hidden mb-1">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: result.passesGate
                  ? 'linear-gradient(90deg, #7FBF3F, #B8FF5C)'
                  : 'linear-gradient(90deg, #B91C1C, #F87171)',
              }}
            />
            {/* Marca del umbral mínimo (3x) */}
            <div
              className="absolute inset-y-0 w-px bg-text-60"
              style={{ left: `${(MIN_MARGIN_MULTIPLE / HEALTHY_MARGIN_MULTIPLE) * 100}%` }}
              title={`Mínimo ${MIN_MARGIN_MULTIPLE}x`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-text-40 mb-3">
            <span>0x</span>
            <span>mín {MIN_MARGIN_MULTIPLE}x</span>
            <span>{HEALTHY_MARGIN_MULTIPLE}x+</span>
          </div>

          <div
            className="flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm"
            style={{
              background: result.passesGate ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${result.passesGate ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
            }}
          >
            <span className="mt-0.5 shrink-0">{result.passesGate ? '✓' : '✕'}</span>
            <span className="text-text-80 leading-snug">{result.gateMessage}</span>
          </div>

          {hasData && (
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
              <div className="text-text-40">
                Ganancia bruta: <span className="text-text-80">{result.grossProfit}</span>
              </div>
              <div className="text-text-40 text-right">
                Margen: <span className="text-text-80">{Math.round(result.marginPct * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-text-40">
          Completá costo y precio para ver si el producto pasa el filtro de margen.
        </p>
      )}
    </div>
  );
}
