import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getMatchesRepo } from '@/features/matches/repository';
import { toNormalizedMatch } from '@/features/matches/to-normalized';
import { resolveBackupDir } from '@/lib/storage/backup-dir';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Copia duradera del partido en la carpeta sincronizada con la nube (iCloud/Drive). */
export async function POST(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  const { dir, source } = await resolveBackupDir();
  const nm = toNormalizedMatch({
    matchId: match.matchId, competition: match.competition, matchday: match.matchday,
    playedAt: match.playedAt, home: match.home, away: match.away, events: match.events,
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = `${match.matchId}__${stamp}.json`;

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, file), JSON.stringify(nm, null, 2), 'utf8');
  } catch (e) {
    return NextResponse.json({ error: `No se pudo escribir la copia: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path: join(dir, file), source, events: match.events.length });
}

/** Dónde se guardarán las copias (para mostrarlo en la UI). */
export async function GET() {
  const { dir, source } = await resolveBackupDir();
  return NextResponse.json({ dir, source, synced: source !== 'local' });
}
