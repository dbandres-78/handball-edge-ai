import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cutClip, probe, CutMode } from './ffmpeg';

export interface ClipSpec { in: number; out: number; label: string }

export interface ClipResult {
  index: number;
  label: string;
  in: number;
  out: number;
  file: string | null;         // nombre del .mp4 dentro de la carpeta del job
  status: 'pending' | 'done' | 'error';
  durationSec?: number;
  error?: string;
}

export interface RenderJob {
  id: string;
  matchId: string;
  mode: CutMode;
  status: 'queued' | 'running' | 'done' | 'error';
  total: number;
  completed: number;
  clips: ClipResult[];
  createdAt: string;
  error?: string;
}

/** COSTURA de infraestructura: en producción esto es Redis/BullMQ + almacenamiento de objetos. */
const jobs = new Map<string, RenderJob>();
const RENDER_ROOT = process.env.RENDER_DIR ?? join(process.cwd(), '.data', 'renders');

const safe = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 40) || 'clip';

export function jobDir(jobId: string): string {
  return join(RENDER_ROOT, jobId);
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export function createRenderJob(input: {
  matchId: string; source: string; clips: ClipSpec[]; mode?: CutMode;
}): RenderJob {
  const id = randomUUID();
  const job: RenderJob = {
    id, matchId: input.matchId, mode: input.mode ?? 'accurate',
    status: 'queued', total: input.clips.length, completed: 0,
    clips: input.clips.map((c, index) => ({
      index, label: c.label, in: c.in, out: c.out, file: null, status: 'pending',
    })),
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  void processJob(job, input.source);
  return job;
}

async function processJob(job: RenderJob, source: string): Promise<void> {
  job.status = 'running';
  try {
    await mkdir(jobDir(job.id), { recursive: true });
    for (const clip of job.clips) {
      const file = `${String(clip.index).padStart(2, '0')}-${safe(clip.label)}.mp4`;
      const outPath = join(jobDir(job.id), file);
      try {
        await cutClip(source, clip.in, clip.out, outPath, job.mode);
        const meta = await probe(outPath);
        clip.file = file;
        clip.durationSec = Math.round(meta.durationSec * 100) / 100;
        clip.status = 'done';
      } catch (err) {
        clip.status = 'error';
        clip.error = (err as Error).message.split('\n')[0];
      }
      job.completed++;
    }
    job.status = job.clips.some((c) => c.status === 'error') && !job.clips.some((c) => c.status === 'done')
      ? 'error' : 'done';
  } catch (err) {
    job.status = 'error';
    job.error = (err as Error).message;
  }
}

/** Utilidad para tests/servidor: espera a que el job termine. */
export async function waitForJob(id: string, timeoutMs = 60_000): Promise<RenderJob> {
  const start = Date.now();
  for (;;) {
    const job = jobs.get(id);
    if (!job) throw new Error(`Job ${id} no existe`);
    if (job.status === 'done' || job.status === 'error') return job;
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout esperando job ${id}`);
    await new Promise((r) => setTimeout(r, 120));
  }
}
