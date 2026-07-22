import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import type { UiEvent } from '@/lib/handball/mapping';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  return NextResponse.json({ events: match.events });
}

export async function PUT(req: Request, { params }: { params: { matchId: string } }) {
  const body = (await req.json()) as { events: UiEvent[] };
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  await (await getMatchesRepo()).saveEvents(params.matchId, body.events ?? []);
  return NextResponse.json({ ok: true, saved: body.events?.length ?? 0 });
}
