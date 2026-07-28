import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

/** GET /api/catalog/clubs/:clubId/roster?season=26/27 — plantilla del club en esa temporada. */
export async function GET(req: Request, { params }: { params: { clubId: string } }) {
  const season = new URL(req.url).searchParams.get('season');
  if (!season) return NextResponse.json({ error: 'Falta la temporada (?season=)' }, { status: 400 });
  const roster = await (await getCatalogRepo()).listRoster(params.clubId, season);
  return NextResponse.json({ roster });
}

/** POST — añade un jugador a la plantilla del club en una temporada. */
export async function POST(req: Request, { params }: { params: { clubId: string } }) {
  const body = (await req.json().catch(() => null)) as
    { season?: string; number?: number; name?: string; position?: string } | null;
  const season = body?.season?.trim();
  const name = body?.name?.trim();
  if (!season || !name || body?.number == null) {
    return NextResponse.json({ error: 'Faltan temporada, dorsal o nombre' }, { status: 400 });
  }
  const player = await (await getCatalogRepo()).addPlayer({
    clubId: params.clubId, season, number: body.number, name, position: body?.position?.trim() || undefined,
  });
  return NextResponse.json({ player }, { status: 201 });
}
