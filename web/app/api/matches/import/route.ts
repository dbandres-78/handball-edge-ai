import { NextResponse } from 'next/server';
import { ReportImportAdapter } from '@handball/core';
import { getMatchesRepo } from '@/features/matches/repository';
import { normalizedToWeb } from '@/lib/handball/ingest-bridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/matches/import
 *
 * Carga un informe real (formato Handball.AI) y lo convierte en un partido de la plataforma:
 *   RawReport → ReportImportAdapter → NormalizedMatch → puente web → repo (partido + eventos).
 *
 * Todos los agregados (marcador, Play Score, xG, save%) se recomputan desde los eventos
 * canónicos, igual que un partido etiquetado a mano. La ingesta no persiste estado derivado.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo no es JSON válido' }, { status: 400 });
  }

  // El adaptador contiene las peculiaridades del informe: alias de patrocinador,
  // posiciones ES (POR/LI/PIV → GK/LB/LP), verbos ES. Si el informe está malformado, falla ruidoso.
  let normalized;
  try {
    normalized = new ReportImportAdapter().toNormalizedMatch(raw as never);
  } catch (err) {
    return NextResponse.json(
      { error: `Informe no reconocido: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  const { create, events } = normalizedToWeb(normalized);
  const repo = await getMatchesRepo();

  const match = await repo.create(create);
  await repo.saveEvents(match.matchId, events);

  return NextResponse.json({
    ok: true,
    matchId: match.matchId,
    competition: match.competition,
    matchday: match.matchday,
    home: match.home.name,
    away: match.away.name,
    eventCount: events.length,
  }, { status: 201 });
}
