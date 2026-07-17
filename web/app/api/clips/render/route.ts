import { NextResponse } from 'next/server';
import { getMatchesRepo } from '@/features/matches/repository';
import { createRenderJob } from '@/lib/video/render-service';
import type { CutMode } from '@/lib/video/ffmpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RenderRequest {
  matchId: string;
  mode?: CutMode;
  clips: Array<{ in: number; out: number; label: string }>;
}

/**
 * Corte real de vídeo. Crea un job que ejecuta ffmpeg por clip sobre el vídeo del servidor.
 * Devuelve un jobId; el estado se consulta en GET /api/clips/render/{jobId}.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RenderRequest | null;
  if (!body || !Array.isArray(body.clips) || body.clips.length === 0) {
    return NextResponse.json({ error: 'Petición inválida: faltan clips' }, { status: 400 });
  }
  const match = await (await getMatchesRepo()).get(body.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  if (!match.videoRef) {
    return NextResponse.json(
      { ok: false, message: 'Sube el vídeo al servidor antes de renderizar los clips.' },
      { status: 422 },
    );
  }

  const job = createRenderJob({
    matchId: body.matchId, source: match.videoRef, clips: body.clips, mode: body.mode ?? 'accurate',
  });
  return NextResponse.json({ ok: true, jobId: job.id, total: job.total });
}
