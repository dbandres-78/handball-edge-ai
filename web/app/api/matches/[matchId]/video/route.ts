import { NextResponse } from 'next/server';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join, extname } from 'node:path';
import { getMatchesRepo } from '@/features/matches/repository';
import { probe } from '@/lib/video/ffmpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), '.data', 'uploads');

/** Extensiones de vídeo admitidas. */
const ALLOWED_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.m4v', '.webm']);
/** Límite duro de tamaño (GB) para evitar llenar el disco. Configurable por entorno. */
const MAX_GB = Number(process.env.MAX_VIDEO_GB ?? 8);

export async function POST(req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });

  if (!req.body) {
    return NextResponse.json({ error: 'Cuerpo de la petición vacío' }, { status: 400 });
  }

  // La extensión viene por query (?ext=.mp4) o cabecera; el cuerpo es el binario crudo.
  const url = new URL(req.url);
  const rawExt = (url.searchParams.get('ext') || '').toLowerCase();
  const ext = ALLOWED_EXT.has(rawExt) ? rawExt : '.mp4';

  await mkdir(UPLOAD_DIR, { recursive: true });
  const dest = join(UPLOAD_DIR, `${params.matchId}${ext}`);
  const maxBytes = MAX_GB * 1024 * 1024 * 1024;

  // STREAMING: el vídeo va del cuerpo de la petición directo a disco, sin pasar entero por RAM.
  // Buffer.from(await file.arrayBuffer()) cargaba GB completos en memoria y reventaba el proceso.
  const nodeStream = Readable.fromWeb(req.body as any);
  let bytes = 0;
  nodeStream.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > maxBytes) nodeStream.destroy(new Error('LIMIT'));
  });

  try {
    await pipeline(nodeStream, createWriteStream(dest));
  } catch (err) {
    // Limpieza: no dejar un archivo a medias en disco.
    await unlink(dest).catch(() => {});
    const msg = (err as Error).message === 'LIMIT'
      ? `El vídeo supera el límite de ${MAX_GB} GB`
      : 'Error al guardar el vídeo';
    return NextResponse.json({ error: msg }, { status: 413 });
  }

  // Verificar que se escribió algo.
  const written = await stat(dest).catch(() => null);
  if (!written || written.size === 0) {
    await unlink(dest).catch(() => {});
    return NextResponse.json({ error: 'No se recibió contenido de vídeo' }, { status: 400 });
  }

  await (await getMatchesRepo()).setVideo(params.matchId, dest);

  let durationSec: number | undefined;
  try { durationSec = Math.round((await probe(dest)).durationSec); } catch { /* probe opcional */ }

  return NextResponse.json({ ok: true, videoRef: dest, sizeBytes: written.size, durationSec });
}

export async function GET(_req: Request, { params }: { params: { matchId: string } }) {
  const match = await (await getMatchesRepo()).get(params.matchId);
  if (!match) return NextResponse.json({ error: 'Partido no encontrado' }, { status: 404 });
  return NextResponse.json({ videoRef: match.videoRef ?? null });
}
