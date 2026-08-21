import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

/** PATCH — edita un jugador de plantilla (dorsal, nombre, posición, alta/baja). */
export async function PATCH(req: Request, { params }: { params: { playerId: string } }) {
  const body = (await req.json().catch(() => null)) as
    { number?: number; name?: string; position?: string; active?: boolean } | null;
  // Solo se incluyen las claves realmente presentes: un PATCH parcial (p.ej. solo `active`)
  // no debe borrar el resto de campos del jugador.
  const patch: { number?: number; name?: string; position?: string; active?: boolean } = {};
  if (body?.number != null) patch.number = body.number;
  if (typeof body?.name === 'string') patch.name = body.name.trim();
  if (typeof body?.position === 'string') patch.position = body.position.trim();
  if (typeof body?.active === 'boolean') patch.active = body.active;
  const player = await (await getCatalogRepo()).updatePlayer(params.playerId, patch);
  if (!player) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
  return NextResponse.json({ player });
}

/** DELETE — borra un jugador del catálogo. scope=all borra toda su identidad (todas sus etapas). */
export async function DELETE(req: Request, { params }: { params: { playerId: string } }) {
  const scope = new URL(req.url).searchParams.get('scope');
  const catalog = await getCatalogRepo();
  if (scope === 'all') {
    const rp = await catalog.getPlayer(params.playerId);
    if (rp) await catalog.removePersonPlayers(rp.personId);
  } else {
    await catalog.removePlayer(params.playerId);
  }
  return NextResponse.json({ ok: true });
}
