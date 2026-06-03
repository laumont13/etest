import { NextRequest, NextResponse } from 'next/server';
import { battleProducts, type BattleResult } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Test fallback ────────────────────────────────────────────────────────────
// Enabled when NEXT_PUBLIC_ENABLE_BATTLE_TEST_FALLBACK=true in .env.local
// Never enabled in production unless that flag is explicitly set.

const TEST_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_BATTLE_TEST_FALLBACK === 'true';

function buildTestFallback(productA: any, productB: any): BattleResult {
  const aScore = productA?.result?.adjustedScore ?? productA?.result?.score ?? 0;
  const bScore = productB?.result?.adjustedScore ?? productB?.result?.score ?? 0;

  const winner: 'A' | 'B' | 'tie' =
    aScore > bScore ? 'A' : bScore > aScore ? 'B' : 'tie';

  const winnerData = winner === 'A' ? productA : productB;
  const loserData  = winner === 'A' ? productB : productA;
  const winnerScore = winner === 'A' ? aScore : bScore;
  const loserScore  = winner === 'A' ? bScore : aScore;

  const BATTLE_DIMS = [
    { dim: 'demand',       label: 'Demanda',            inverted: false },
    { dim: 'adPotential',  label: 'Pot. publicitario',  inverted: false },
    { dim: 'wowFactor',    label: 'Factor wow',         inverted: false },
    { dim: 'offerStrength', label: 'Fuerza de oferta',  inverted: false },
    { dim: 'risks',        label: 'Riesgos',            inverted: true  },
    { dim: 'scalability',  label: 'Escalabilidad',      inverted: false },
    { dim: 'logistics',    label: 'Logística',          inverted: true  },
    { dim: 'ltv',          label: 'Recompra / LTV',     inverted: false },
  ];

  const dimRaw = (data: any, dim: string): number =>
    (data?.result?.breakdown ?? []).find((b: any) => b.key === dim)?.raw ?? 3;

  const dimensionWins = BATTLE_DIMS.map(({ dim, label, inverted }) => {
    const aRaw = dimRaw(productA, dim);
    const bRaw = dimRaw(productB, dim);
    const aEff = inverted ? 6 - aRaw : aRaw;
    const bEff = inverted ? 6 - bRaw : bRaw;
    const dimWinner: 'A' | 'B' | 'tie' = aEff > bEff ? 'A' : bEff > aEff ? 'B' : 'tie';
    return { dim, label, winner: dimWinner, aScore: aRaw, bScore: bRaw };
  });

  return {
    winner,
    winnerConfidence: 60,
    keyDifference: winner === 'tie'
      ? 'Scores idénticos — resultado de prueba sin IA.'
      : `Ganador elegido por score más alto (${winnerScore} vs ${loserScore} pts) en modo test.`,
    summary: `Resultado de prueba generado porque la IA no estuvo disponible. ${
      winner === 'tie'
        ? 'Scores empatados.'
        : `${winnerData?.product?.title ?? 'Producto ' + winner} tiene score superior.`
    } Sirve solo para validar el flujo hasta el Board.`,
    recommendation:
      'Repetir Battle Mode con IA activa antes de tomar cualquier decisión de inversión.',
    winnerByAds: winner,
    winnerBySaturation: winner,
    winnerLongTerm: winner,
    loserRisks: [
      'Score menor en esta comparación de prueba.',
      `${loserData?.product?.title ?? 'Producto perdedor'} debe compararse nuevamente cuando la IA esté disponible.`,
    ],
    smartMove:
      'Crear el Board del ganador solo para verificar que el flujo, productId y persistencia funcionan correctamente. Validar con IA real antes de decidir.',
    dimensionWins,
    aStrengths: [],
    bStrengths: [],
    aWeaknesses: [],
    bWeaknesses: [],
    testMode: true,
    fallback: true,
    fallbackReason: 'IA no disponible durante testeo',
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { productA, productB } = body ?? {};
  if (!productA || !productB) {
    return NextResponse.json({ error: 'Se requieren productA y productB' }, { status: 400 });
  }

  try {
    const result = await battleProducts(productA, productB);
    return NextResponse.json(result);
  } catch (e) {
    if (TEST_FALLBACK_ENABLED) {
      console.warn('[battle] IA falló — usando fallback de test. Razón:', String(e).slice(0, 120));
      return NextResponse.json(buildTestFallback(productA, productB));
    }
    return NextResponse.json(
      { error: 'Error en la comparación IA', detail: String(e) },
      { status: 502 },
    );
  }
}
