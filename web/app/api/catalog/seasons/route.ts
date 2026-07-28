import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  const seasons = await (await getCatalogRepo()).listSeasons();
  return NextResponse.json({ seasons });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { code?: string; label?: string } | null;
  const code = body?.code?.trim();
  if (!code) return NextResponse.json({ error: 'Falta el código de temporada' }, { status: 400 });
  const season = await (await getCatalogRepo()).ensureSeason(code, body?.label?.trim() || undefined);
  return NextResponse.json({ season }, { status: 201 });
}
