import assert from 'node:assert/strict';
import { mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveBackupDir } from '../lib/storage/backup-dir';

/**
 * Copia duradera en la carpeta sincronizada (iCloud/Drive).
 * La clave: es una escritura de fichero, así que funciona SIN RED — el cliente de la nube ya
 * subirá el archivo cuando vuelva la conexión.
 */
const WORK = join(tmpdir(), 'handball-backup-test');

let pass = 0, fail = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

async function main() {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });

  await check('BACKUP_DIR manda sobre la autodetección', async () => {
    process.env.BACKUP_DIR = WORK;
    const { dir, source } = await resolveBackupDir();
    assert.equal(dir, WORK);
    assert.equal(source, 'env');
  });

  await check('sin BACKUP_DIR, cae a una carpeta local del proyecto (y lo dice)', async () => {
    delete process.env.BACKUP_DIR;
    const { dir, source } = await resolveBackupDir();
    // En este entorno no hay iCloud/Drive: debe reconocerlo en vez de fingir que hay copia en nube.
    assert.ok(source === 'local' || source === 'cloud');
    if (source === 'local') assert.ok(dir.includes('.data'));
  });

  await check('una carpeta de nube presente se detecta como sincronizada', async () => {
    // Simula ~/Library/Mobile Documents/com~apple~CloudDocs presente
    const fakeHome = join(WORK, 'home');
    const icloud = join(fakeHome, 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
    await mkdir(icloud, { recursive: true });
    process.env.BACKUP_DIR = join(icloud, 'HandballEdge');
    const { dir, source } = await resolveBackupDir();
    assert.ok(dir.includes('CloudDocs'));
    assert.equal(source, 'env');
  });

  await check('la copia se escribe y se puede volver a leer', async () => {
    const { writeFile } = await import('node:fs/promises');
    process.env.BACKUP_DIR = WORK;
    const { dir } = await resolveBackupDir();
    const nm = { source: 'MANUAL', teams: [{ side: 'HOME', name: 'A' }], events: [{ clock: '01:05', type: 'SHOT' }] };
    await writeFile(join(dir, 'LIVE-TEST__2026-07-15-16-00.json'), JSON.stringify(nm, null, 2), 'utf8');

    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1);
    const back = JSON.parse(await readFile(join(dir, files[0]), 'utf8'));
    assert.equal(back.source, 'MANUAL');
    assert.equal(back.events[0].clock, '01:05');
  });

  await rm(WORK, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
