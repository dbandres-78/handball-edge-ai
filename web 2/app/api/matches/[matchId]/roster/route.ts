import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import type { UiTeam } from '@/lib/handball/mapping';

export const dynamic = 'force-dynamic';

/**
 * Persiste plantillas y alineación (nombres, porteros, titulares). Los cambios de jugadores
 * en pista viajan como eventos (SUBSTITUTION); esto guarda el estado del roster que define
 * la alineación inicial, base del ± fino.
 */
export async function PUT(req: Request, { params }: { params: { matchId: string } }) {
  const body = (await req.json()) as { home: UiTeam; away: UiTeam };
  const repo = await getMatchesRepo();
  const match = await repo.get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  if (!body.home || !body.away) return NextResponse.json({ error: 'Falta home/away' }, { status: 400 });
  await repo.saveRoster(params.matchId, body.home, body.away);
  return NextResponse.json({ ok: true });
}
