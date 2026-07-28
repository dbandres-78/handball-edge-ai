import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getMatchesRepo } from '@/features/matches/repository';

export const dynamic = 'force-dynamic';

/** DELETE — borra el partido (filas de BD) y, en la medida de lo posible, su vídeo subido. */
export async function DELETE(_req: Request, { params }: { params: { matchId: string } }) {
  const matchId = params.matchId;
  await (await getMatchesRepo()).delete(matchId);

  // Limpieza best-effort del vídeo subido (.data/uploads/<matchId>.<ext>). Nunca rompe el borrado.
  try {
    const dir = join(process.cwd(), '.data', 'uploads');
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    for (const f of files) {
      if (f === matchId || f.startsWith(`${matchId}.`)) {
        await fs.unlink(join(dir, f)).catch(() => {});
      }
    }
  } catch { /* la limpieza de vídeo es opcional */ }

  return NextResponse.json({ ok: true });
}
