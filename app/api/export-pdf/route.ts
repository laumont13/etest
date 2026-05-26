/**
 * E-Test · /api/export-pdf
 * ----------------------------------------------------------------------------
 * Genera un PDF del análisis con @react-pdf/renderer. Recibe el payload del
 * análisis y devuelve el binario para descargar.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import React from 'react';

export const runtime = 'nodejs';
export const maxDuration = 30;

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: '#0A0A0B', color: '#FFFFFF', fontSize: 11 },
  h1: { fontSize: 22, marginBottom: 4, color: '#B8FF5C' },
  meta: { fontSize: 9, color: '#888', marginBottom: 20 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  scoreBig: { fontSize: 48 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, color: '#B8FF5C', marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { color: '#aaa' },
  reason: { color: '#ddd', lineHeight: 1.5, marginBottom: 16 },
  bullet: { color: '#ddd', marginBottom: 2 },
});

function verdictColor(v: string): string {
  return v === 'go' ? '#4ADE80' : v === 'maybe' ? '#FACC15' : '#F87171';
}
function verdictLabel(v: string): string {
  return v === 'go' ? 'AVANZAR' : v === 'maybe' ? 'DUDOSO' : 'DESCARTAR';
}

export async function POST(req: NextRequest) {
  let data: any;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const r = data?.result;
  if (!r) return NextResponse.json({ error: 'Falta result' }, { status: 400 });

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h1 }, data.product?.title ?? 'Análisis'),
      React.createElement(
        Text,
        { style: styles.meta },
        `${data.product?.country ?? ''} · ${new Date(data.generatedAt ?? Date.now()).toLocaleDateString('es')}`,
      ),
      React.createElement(
        View,
        { style: styles.scoreRow },
        React.createElement(
          Text,
          { style: { ...styles.scoreBig, color: verdictColor(r.verdict) } },
          `${r.score}/100`,
        ),
        React.createElement(
          Text,
          { style: { fontSize: 16, color: verdictColor(r.verdict), marginTop: 16 } },
          verdictLabel(r.verdict),
        ),
      ),
      React.createElement(Text, { style: styles.reason }, r.reason),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Margen'),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Múltiplo'),
          React.createElement(Text, null, `${data.margin?.multiple}x`),
        ),
        React.createElement(
          View,
          { style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Ganancia bruta'),
          React.createElement(Text, null, `${data.margin?.grossProfit}`),
        ),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Posicionamiento'),
        React.createElement(Text, { style: styles.reason }, data.analysis?.positioning ?? ''),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Riesgos clave'),
        ...(data.analysis?.keyRisks ?? []).map((risk: string, i: number) =>
          React.createElement(Text, { key: i, style: styles.bullet }, `• ${risk}`),
        ),
      ),
    ),
  );

  const buffer = await renderToBuffer(doc as any);

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="etest-${slug(data.product?.title)}.pdf"`,
    },
  });
}

function slug(s?: string): string {
  return (s ?? 'analisis')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
