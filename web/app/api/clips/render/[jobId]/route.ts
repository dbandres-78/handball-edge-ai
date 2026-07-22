import { NextResponse } from 'next/server';
import { getJob } from '@/lib/video/render-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId);
  if (!job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 });

  return NextResponse.json({
    id: job.id, matchId: job.matchId, mode: job.mode, status: job.status,
    total: job.total, completed: job.completed,
    clips: job.clips.map((c) => ({
      index: c.index, label: c.label, in: c.in, out: c.out,
      status: c.status, durationSec: c.durationSec, error: c.error,
      downloadUrl: c.file ? `/api/clips/render/${job.id}/${encodeURIComponent(c.file)}` : null,
    })),
  });
}
