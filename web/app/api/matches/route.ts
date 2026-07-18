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

/**
 * Plantilla por defecto RFEBM: hasta 16 jugadores, dorsales 1–100.
 * Convención: #1 y #12 son porteros. Se edita luego en la sala.
 */
const defaultRoster = (count: number) => {
  const n = Math.min(Math.max(count, 7), 16);
  return Array.from({ length: n }, (_, i) => {
    const number = i + 1;
    const isGk = number === 1 || number === 12;
    return { number, name: isGk ? `Portero ${number}` : `Jugador ${number}`, gk: isGk };
  });
};

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
    home: { name: homeName, players: defaultRoster(body?.home?.count ?? 16) },
    away: { name: awayName, players: defaultRoster(body?.away?.count ?? 16) },
  });

  return NextResponse.json({ ok: true, matchId: match.matchId, mode: match.mode }, { status: 201 });
}
