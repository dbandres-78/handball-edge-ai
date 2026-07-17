import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { getMatchesRepo } from '@/features/matches/repository';
import { probe } from '@/lib/video/ffmpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), '.data', 'uploads');

export async function POST(req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo de vídeo' }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extname(file.name) || '.mp4';
  const dest = join(UPLOAD_DIR, `${params.matchId}${ext}`);
  await writeFile(dest, Buffer.from(await file.arrayBuffer()));
  await (await getMatchesRepo()).setVideo(params.matchId, dest);

  let durationSec: number | undefined;
  try { durationSec = Math.round((await probe(dest)).durationSec); } catch { /* probe opcional */ }

  return NextResponse.json({ ok: true, videoRef: dest, durationSec });
}

export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  return NextResponse.json({ videoRef: match.videoRef ?? null });
}
