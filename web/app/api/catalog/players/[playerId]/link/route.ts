import { NextResponse } from 'next/server';
import { getCatalogRepo } from '@/features/catalog/repository';

export const dynamic = 'force-dynamic';

/**
 * Vincula el jugador `id` con `targetId`: pasan a compartir identidad (person_id), de modo que su
 * carrera se agrega entre clubes/temporadas. Manual y explícito (sin fusión automática por nombre).
 */
export async function POST(req: Request, { params }: { params: { playerId: string } }) {
  const body = (await req.json().catch(() => null)) as { targetId?: string } | null;
  const targetId = body?.targetId;
  if (!targetId) return NextResponse.json({ error: 'Falta targetId' }, { status: 400 });

  const catalog = await getCatalogRepo();
  const [src, tgt] = await Promise.all([catalog.getPlayer(params.playerId), catalog.getPlayer(targetId)]);
  if (!src || !tgt) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });

  await catalog.mergePersons(params.playerId, targetId);
  const person = (await catalog.getPlayer(targetId))!.personId;
  return NextResponse.json({ ok: true, personId: person });
}
