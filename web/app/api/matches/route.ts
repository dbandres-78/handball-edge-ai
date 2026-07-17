import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import type { CaptureMode } from '@/features/matches/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await (await getMatchesRepo()).list();
  return NextResponse.json({ items });
}

interface CreateBody {
  competition?: string;
  matchday?: number;
  mode?: CaptureMode;
  periodMinutes?: number;
  home?: { name?: string; count?: number };
  away?: { name?: string; count?: number };
}

/** Plantilla por defecto: 1 portero + n jugadores de campo. Se edita luego en la sala. */
const defaultRoster = (count: number) => [
  { number: 1, name: 'Portero', gk: true },
  ...Array.from({ length: Math.max(0, count - 1) }, (_, i) => ({ number: i + 2, name: `Jugador ${i + 2}` })),
];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  const homeName = body?.home?.name?.trim();
  const awayName = body?.away?.name?.trim();
  if (!homeName || !awayName) {
    return NextResponse.json({ error: 'Faltan los nombres de los equipos' }, { status: 400 });
  }

  const match = await (await getMatchesRepo()).create({
    competition: body?.competition?.trim() || undefined,
    matchday: body?.matchday,
    mode: body?.mode === 'live' ? 'live' : 'video',
    periodMinutes: body?.periodMinutes ?? 30,
    home: { name: homeName, players: defaultRoster(body?.home?.count ?? 12) },
    away: { name: awayName, players: defaultRoster(body?.away?.count ?? 12) },
  });

  return NextResponse.json({ ok: true, matchId: match.matchId, mode: match.mode }, { status: 201 });
}
