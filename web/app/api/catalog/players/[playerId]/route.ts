import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

/** PATCH — edita un jugador de plantilla (dorsal, nombre, posición, alta/baja). */
export async function PATCH(req: Request, { params }: { params: { playerId: string } }) {
  const body = (await req.json().catch(() => null)) as
    { number?: number; name?: string; position?: string; active?: boolean } | null;
  const player = await (await getCatalogRepo()).updatePlayer(params.playerId, {
    number: body?.number, name: body?.name?.trim(), position: body?.position?.trim(), active: body?.active,
  });
  if (!player) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
  return NextResponse.json({ player });
}

/** DELETE — quita un jugador de la plantilla. */
export async function DELETE(_req: Request, { params }: { params: { playerId: string } }) {
  await (await getCatalogRepo()).removePlayer(params.playerId);
  return NextResponse.json({ ok: true });
}
