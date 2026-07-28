import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import type { CaptureMode } from '@/features/matches/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await (await getMatchesRepo()).list();
  return NextResponse.json({ items });
}

interface RosterInput { number: number; name: string; gk?: boolean; playerId?: string }
interface SideInput { name?: string; count?: number; clubId?: string; players?: RosterInput[] }
interface CreateBody {
  competition?: string;
  matchday?: number;
  mode?: CaptureMode;
  periodMinutes?: number;
  season?: string;
  home?: SideInput;
  away?: SideInput;
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

  // Si el lado trae plantilla real (flujo "Nuevo partido de vídeo"), se usa tal cual —con sus
  // enlaces al catálogo—; si no, se cae a la plantilla genérica (flujo directo/rápido).
  const sideRoster = (s?: SideInput) =>
    s?.players && s.players.length
      ? s.players.map((p) => ({ number: p.number, name: p.name, gk: !!p.gk, playerId: p.playerId }))
      : defaultRoster(s?.count ?? 16);

  const match = await (await getMatchesRepo()).create({
    competition: body?.competition?.trim() || undefined,
    matchday: body?.matchday,
    mode: body?.mode === 'live' ? 'live' : 'video',
    periodMinutes: body?.periodMinutes ?? 30,
    season: body?.season?.trim() || undefined,
    home: { name: homeName, clubId: body?.home?.clubId, players: sideRoster(body?.home) },
    away: { name: awayName, clubId: body?.away?.clubId, players: sideRoster(body?.away) },
  });

  return NextResponse.json({ ok: true, matchId: match.matchId, mode: match.mode }, { status: 201 });
}
