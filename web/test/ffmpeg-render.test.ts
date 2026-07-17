import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRenderJob, waitForJob, jobDir } from '../lib/video/render-service';
import { probe, ffmpegAvailable } from '../lib/video/ffmpeg';

const run = promisify(execFile);
const WORK = join(tmpdir(), 'handball-render-test');

async function makeSource(path: string, seconds: number): Promise<void> {
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `testsrc=size=320x240:rate=15:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', path,
  ], { maxBuffer: 1024 * 1024 * 16 });
}

async function main() {
  if (!(await ffmpegAvailable())) {
    console.log('  · ffmpeg no disponible — test omitido');
    return;
  }
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  process.env.RENDER_DIR = join(WORK, 'renders');

  const source = join(WORK, 'source.mp4');
  await makeSource(source, 20);
  const src = await probe(source);
  assert.ok(src.durationSec >= 19 && src.durationSec <= 21, `origen ~20s (fue ${src.durationSec})`);

  const clips = [
    { in: 2, out: 5, label: 'Gol · #7' },     // 3.0s
    { in: 10, out: 12.5, label: 'Parada #1' }, // 2.5s
  ];

  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, extra = '') => {
    if (cond) { console.log(`  \u2713 ${name}`); pass++; }
    else { console.log(`  \u2717 ${name}  ${extra}`); fail++; }
  };

  const job = createRenderJob({ matchId: 'J24', source, clips, mode: 'accurate' });
  check('el job arranca en cola/ejecución', job.status === 'queued' || job.status === 'running');

  const done = await waitForJob(job.id, 60_000);
  check('el job termina en done', done.status === 'done', `(status=${done.status})`);
  check('se procesan los 2 clips', done.completed === 2, `(completed=${done.completed})`);

  for (const c of done.clips) {
    check(`clip ${c.index} generado`, c.status === 'done' && !!c.file, c.error ?? '');
    if (c.file) {
      const p = join(jobDir(job.id), c.file);
      const st = await stat(p).catch(() => null);
      check(`clip ${c.index} escrito en disco`, !!st && st.size > 0);
      const expected = c.out - c.in;
      const near = c.durationSec != null && Math.abs(c.durationSec - expected) <= 0.4;
      check(`clip ${c.index} dura ~${expected}s`, near, `(fue ${c.durationSec}s)`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await rm(WORK, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
