import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';

export type CutMode = 'fast' | 'accurate';

export interface ProbeResult {
  durationSec: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
}

/** Metadatos del vídeo vía ffprobe. */
export async function probe(source: string): Promise<ProbeResult> {
  const { stdout } = await run(FFPROBE, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', source,
  ], { maxBuffer: 1024 * 1024 * 8 });
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  };
  const video = data.streams?.find((s) => s.codec_type === 'video');
  return {
    durationSec: Number(data.format?.duration ?? 0),
    width: video?.width,
    height: video?.height,
    hasAudio: !!data.streams?.some((s) => s.codec_type === 'audio'),
  };
}

/**
 * Corta un clip [inSec, outSec) del origen a outPath.
 * - 'fast'    : -c copy. Rapidísimo pero alinea al keyframe más cercano (no frame-exacto).
 * - 'accurate': reencode H.264/AAC. Corte frame-exacto (lo que un analista suele querer).
 * En ambos casos se usa seek de entrada (-ss antes de -i) para que sea rápido.
 */
export async function cutClip(
  source: string, inSec: number, outSec: number, outPath: string, mode: CutMode = 'accurate',
): Promise<void> {
  const dur = Math.max(0.05, outSec - inSec);
  const base = ['-y', '-ss', inSec.toFixed(3), '-i', source, '-t', dur.toFixed(3)];
  const codec = mode === 'fast'
    ? ['-c', 'copy', '-avoid_negative_ts', 'make_zero']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart'];
  await run(FFMPEG, [...base, ...codec, outPath], { maxBuffer: 1024 * 1024 * 16 });
}

export async function ffmpegAvailable(): Promise<boolean> {
  try { await run(FFMPEG, ['-version'], { maxBuffer: 1024 * 1024 }); return true; }
  catch { return false; }
}
