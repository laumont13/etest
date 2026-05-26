'use client';

import { useMemo } from 'react';
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

/**
 * Gate de margen: el primer filtro, instantáneo y gratis. Calcula el múltiplo
 * precio/costo en vivo mientras el usuario tipea. Si no llega a 3x, marca el
 * producto como muerto antes de gastar un solo token de IA.
 */
export default function MarginGate({ values, onChange }: Props) {
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
  ) => (
    <div className="flex flex-col gap-1.5">
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
    </div>
  );

  return (
    <div className="rounded-2xl border border-border-soft bg-bg-1/80 backdrop-blur p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-display text-lg text-text-100">Gate de margen</h3>
        <span className="text-[11px] uppercase tracking-[0.14em] font-mono text-text-40">
          Filtro 1 · instantáneo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {field('unitCost', 'Costo unitario', '0.00')}
        {field('shippingCost', 'Envío / import.', '0.00')}
        {field('fees', 'Fees', '0.00')}
        {field('sellPrice', 'Precio venta', '0.00')}
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
