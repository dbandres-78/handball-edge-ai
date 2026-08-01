import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import { getCatalogRepo } from '@/features/catalog/repository';
import { buildPlayerCareer } from '@/features/catalog/projection';
import type { LoadedMatch } from '@/features/matches/types';

export const dynamic = 'force-dynamic';

/** Carrera de una persona (agrega sus pertenencias en todos los clubes/temporadas). */
export async function GET(_req: Request, { params }: { params: { personId: string } }) {
  const [matchesRepo, catalog] = await Promise.all([getMatchesRepo(), getCatalogRepo()]);

  const refs = await catalog.listByPerson(params.personId);
  if (refs.length === 0) return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });

  const items = await matchesRepo.list();
  const loaded = (await Promise.all(items.map((i) => matchesRepo.get(i.matchId)))).filter(Boolean) as LoadedMatch[];

  const career = buildPlayerCareer(loaded, refs, params.personId);
  return NextResponse.json({ career, memberships: refs });
}
