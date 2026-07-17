import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { getJob, jobDir } from '@/lib/video/render-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { jobId: string; file: string } }) {
  const job = getJob(params.jobId);
  if (!job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });

  // Anti path-traversal: solo el basename, y debe corresponder a un clip del job.
  const name = basename(decodeURIComponent(params.file));
  const known = job.clips.some((c) => c.file === name);
  if (!known) return NextResponse.json({ error: 'Clip no encontrado' }, { status: 404 });

  try {
    const data = await readFile(join(jobDir(job.id), name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'content-type': 'video/mp4',
        'content-disposition': `attachment; filename="${name}"`,
        'content-length': String(data.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 });
  }
}
