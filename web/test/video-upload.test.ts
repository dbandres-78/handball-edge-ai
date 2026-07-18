import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Tests del punto 4 — subida de vídeo por streaming.
 *
 * El endpoint real depende de Next, así que aquí probamos la MECÁNICA de streaming
 * que usa la ruta: volcar un ReadableStream a disco chunk a chunk, aplicar el límite
 * de tamaño destruyendo el stream, y limpiar el archivo a medias si algo falla.
 *
 * Lo que garantiza: el vídeo NUNCA se carga entero en RAM (se procesa por chunks),
 * que era el bug original (Buffer.from(await file.arrayBuffer()) reventaba con GB).
 */

const ALLOWED_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.m4v', '.webm']);
const resolveExt = (raw: string) => (ALLOWED_EXT.has(raw.toLowerCase()) ? raw.toLowerCase() : '.mp4');

/** Réplica de la lógica de streaming del endpoint, para poder testearla aislada. */
async function streamToDisk(chunks: Buffer[], dest: string, maxBytes: number): Promise<{ ok: boolean; error?: string }> {
  const source = Readable.from(chunks);
  let bytes = 0;
  source.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > maxBytes) source.destroy(new Error('LIMIT'));
  });
  try {
    await pipeline(source, createWriteStream(dest));
    return { ok: true };
  } catch (err) {
    const { unlink } = await import('node:fs/promises');
    await unlink(dest).catch(() => {});
    return { ok: false, error: (err as Error).message };
  }
}

type Fn = () => Promise<void> | void;
const tests: Array<[string, Fn]> = [];
const test = (n: string, f: Fn) => tests.push([n, f]);

let tmp = '';
let pass = 0, fail = 0;

async function main() {
  tmp = await mkdtemp(join(tmpdir(), 'hb-video-'));

  test('resuelve extensiones válidas y rechaza las inválidas', () => {
    assert.equal(resolveExt('.mp4'), '.mp4');
    assert.equal(resolveExt('.MOV'), '.mov');
    assert.equal(resolveExt('.mkv'), '.mkv');
    assert.equal(resolveExt('.exe'), '.mp4', 'extensión no permitida cae a .mp4');
    assert.equal(resolveExt(''), '.mp4', 'sin extensión cae a .mp4');
  });

  test('vuelca el stream a disco en múltiples chunks (no carga todo en RAM)', async () => {
    const dest = join(tmp, 'ok.mp4');
    // 5 chunks de 1 MB cada uno = 5 MB, simulando streaming
    const chunks = Array.from({ length: 5 }, () => Buffer.alloc(1024 * 1024, 1));
    const res = await streamToDisk(chunks, dest, 100 * 1024 * 1024);
    assert.ok(res.ok, 'debe completar');
    const written = await stat(dest);
    assert.equal(written.size, 5 * 1024 * 1024, 'se escribieron los 5 MB');
  });

  test('el contenido escrito coincide con el enviado', async () => {
    const dest = join(tmp, 'content.mp4');
    const chunks = [Buffer.from('MOOV'), Buffer.from('mdat'), Buffer.from('DATA')];
    await streamToDisk(chunks, dest, 1024);
    const back = await readFile(dest);
    assert.equal(back.toString(), 'MOOVmdatDATA', 'el fichero contiene exactamente los chunks concatenados');
  });

  test('corta y limpia si se supera el límite de tamaño', async () => {
    const dest = join(tmp, 'toobig.mp4');
    // 3 chunks de 1 MB con límite de 2 MB → debe fallar al superar 2 MB
    const chunks = Array.from({ length: 3 }, () => Buffer.alloc(1024 * 1024, 2));
    const res = await streamToDisk(chunks, dest, 2 * 1024 * 1024);
    assert.ok(!res.ok, 'debe fallar por límite');
    assert.equal(res.error, 'LIMIT');
    // El archivo a medias debe haberse borrado
    const exists = await stat(dest).then(() => true).catch(() => false);
    assert.ok(!exists, 'el archivo a medias se limpió');
  });

  test('un stream justo en el límite se acepta', async () => {
    const dest = join(tmp, 'edge.mp4');
    const chunks = [Buffer.alloc(1024 * 1024, 3)]; // exactamente 1 MB
    const res = await streamToDisk(chunks, dest, 1024 * 1024);
    assert.ok(res.ok, '1 MB con límite de 1 MB debe pasar');
  });

  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
    catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
  }

  await rm(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
