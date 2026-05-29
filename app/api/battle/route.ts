import { NextRequest, NextResponse } from 'next/server';
import { battleProducts } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    return NextResponse.json(
      { error: 'Error en la comparación IA', detail: String(e) },
      { status: 502 },
    );
  }
}
