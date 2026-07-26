/**
 * Diagnóstico del entorno (npm run doctor).
 *
 * Comprueba, en lenguaje llano, que este ordenador tiene todo lo necesario para
 * analizar partidos: Node, ffmpeg/ffprobe (cortar clips), Postgres (guardar datos),
 * permisos de escritura y espacio en disco. Cada fallo dice EXACTAMENTE qué hacer.
 *
 * No modifica nada: solo mira y reporta.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { statfs } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { platform, homedir } from 'node:os';

const run = promisify(execFile);
const isMac = platform() === 'darwin';
const isWin = platform() === 'win32';

let ok = 0, warn = 0, bad = 0;
const pass = (m: string, extra = '') => { ok++; console.log(`  ✅ ${m}${extra ? `  ${dim(extra)}` : ''}`); };
const advert = (m: string, fix: string) => { warn++; console.log(`  ⚠️  ${m}\n      → ${fix}`); };
const fail = (m: string, fix: string) => { bad++; console.log(`  ❌ ${m}\n      → ${fix}`); };
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const title = (s: string) => console.log(`\n${s}`);

/** Lee DATABASE_URL del entorno o de .env.local (como hace Next). */
async function databaseUrl(): Promise<string | undefined> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const p = join(process.cwd(), '.env.local');
  if (!existsSync(p)) return undefined;
  for (const line of (await readFile(p, 'utf8')).split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
    if (m) return m[1];
  }
  return undefined;
}

const INSTALL_BREW = isMac
  ? 'Instala Homebrew (una vez) pegando esto en Terminal:\n         /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  : 'Consulta la guía de instalación de tu sistema.';

const FIX_FFMPEG = isMac
  ? `Abre Terminal (Cmd+Espacio, escribe "Terminal") y ejecuta:\n         brew install ffmpeg\n      Si dice "command not found: brew": ${INSTALL_BREW}`
  : isWin
    ? 'Descarga ffmpeg de https://www.gyan.dev/ffmpeg/builds/ y añade su carpeta bin al PATH.'
    : 'Instala ffmpeg con el gestor de paquetes de tu sistema (p. ej. apt install ffmpeg).';

const FIX_PG = isMac
  ? 'Instala Postgres.app desde https://postgresapp.com — arrástralo a Aplicaciones, ábrelo\n        y pulsa "Initialize". Después crea la base "handball" (ver MACOS.md).'
  : 'Instala PostgreSQL 16 y crea la base "handball" (ver POSTGRES_LOCAL.md).';

async function main() {
  console.log(`\nDiagnóstico de Handball Edge AI  ${dim(`(${isMac ? 'macOS' : isWin ? 'Windows' : platform()})`)}`);

  // ── 1. Node ────────────────────────────────────────────────────────────────
  title('1. Node.js');
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) pass(`Node ${process.versions.node}`, 'versión suficiente (18+)');
  else fail(`Node ${process.versions.node} es demasiado antiguo`,
    isMac ? 'Ejecuta en Terminal:  brew install node' : 'Instala Node 18 o superior desde https://nodejs.org');

  // ── 2. ffmpeg / ffprobe (cortar clips) ─────────────────────────────────────
  title('2. Recorte de vídeo (ffmpeg)');
  const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
  const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';
  let haveFfmpeg = false;
  try {
    const { stdout } = await run(FFMPEG, ['-version'], { maxBuffer: 1 << 20 });
    haveFfmpeg = true;
    pass('ffmpeg disponible', stdout.split('\n')[0].slice(0, 60));
  } catch {
    fail('No se encuentra ffmpeg: sin él NO se pueden cortar clips', FIX_FFMPEG);
  }
  try {
    await run(FFPROBE, ['-version'], { maxBuffer: 1 << 20 });
    pass('ffprobe disponible', 'lee duración y resolución del vídeo');
  } catch {
    fail('No se encuentra ffprobe (viene con ffmpeg)', FIX_FFMPEG);
  }

  // Prueba real de corte: genera 2s de vídeo y córtalo. Detecta ffmpeg roto o sin códecs.
  if (haveFfmpeg) {
    const tmp = join(process.cwd(), '.data', 'doctor');
    try {
      await mkdir(tmp, { recursive: true });
      const src = join(tmp, 'src.mp4'), out = join(tmp, 'out.mp4');
      await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=320x240:rate=25',
        '-c:v', 'libx264', '-preset', 'ultrafast', src], { maxBuffer: 1 << 22 });
      await run(FFMPEG, ['-y', '-ss', '0.5', '-i', src, '-t', '1',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', out], { maxBuffer: 1 << 22 });
      pass('corte de prueba correcto', 'H.264 disponible (modo preciso)');
      await unlink(src).catch(() => {}); await unlink(out).catch(() => {});
    } catch (e) {
      advert('ffmpeg responde pero falló el corte de prueba',
        `Puede faltarle el códec H.264. En Mac reinstala con:  brew reinstall ffmpeg\n         Detalle: ${(e as Error).message.split('\n')[0].slice(0, 80)}`);
    }
  }

  // ── 3. Postgres ────────────────────────────────────────────────────────────
  title('3. Base de datos (Postgres)');
  const url = await databaseUrl();
  if (!url) {
    advert('No hay DATABASE_URL: la app funcionará en memoria y PERDERÁS los datos al cerrar',
      'Crea el archivo web/.env.local con una línea:\n         DATABASE_URL=postgresql://TU_USUARIO@localhost:5432/handball\n      (en Postgres.app, TU_USUARIO es tu nombre de usuario del Mac)');
  } else {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 4000 });
      const r = await pool.query('SELECT version()');
      pass('conexión con Postgres correcta', String(r.rows[0].version).slice(0, 40));
      const t = await pool.query(`SELECT to_regclass('public.match') AS t`);
      if (t.rows[0].t) {
        const n = await pool.query('SELECT count(*)::int AS n FROM match');
        pass(`base de datos preparada`, `${n.rows[0].n} partido(s) guardado(s)`);
      } else {
        advert('La base existe pero aún está vacía (sin tablas)',
          'Es normal la primera vez: se crean solas al abrir la app con  npm run dev');
      }
      await pool.end();
    } catch (e) {
      fail(`No se pudo conectar a Postgres  ${dim((e as Error).message.slice(0, 60))}`, FIX_PG);
    }
  }

  // ── 4. Permisos de escritura ───────────────────────────────────────────────
  title('4. Carpeta de trabajo (vídeos y clips)');
  try {
    const d = join(process.cwd(), '.data');
    await mkdir(d, { recursive: true });
    const probe = join(d, '.doctor-write-test');
    await writeFile(probe, 'ok');
    await unlink(probe);
    pass('se puede escribir en .data', 'aquí van vídeos subidos y clips');
  } catch {
    fail('No se puede escribir en la carpeta .data',
      'Mueve el proyecto a tu carpeta personal (por ejemplo ~/Documentos) y evita\n        carpetas protegidas como Escritorio sincronizado o Descargas del sistema.');
  }

  // ── 5. Espacio en disco ────────────────────────────────────────────────────
  title('5. Espacio en disco');
  if (typeof statfs !== 'function') {
    advert('Tu versión de Node no permite leer el espacio libre', 'Comprueba a mano que tienes al menos 20 GB para los vídeos.');
  } else await new Promise<void>((resolve) => {
    statfs(process.cwd(), (err, s) => {
      if (err) { advert('No se pudo leer el espacio libre', 'Comprueba a mano que tienes sitio para los vídeos.'); return resolve(); }
      const freeGb = (s.bsize * s.bavail) / 1024 ** 3;
      const msg = `${freeGb.toFixed(1)} GB libres`;
      if (freeGb >= 20) pass('espacio suficiente', msg);
      else if (freeGb >= 5) advert(`Queda poco espacio (${msg})`, 'Un partido en HD ocupa varios GB; libera sitio antes de subir vídeos.');
      else fail(`Espacio insuficiente (${msg})`, 'Libera al menos 20 GB antes de trabajar con vídeo.');
      resolve();
    });
  });

  // ── 6. Copia de seguridad ──────────────────────────────────────────────────
  title('6. Copia de seguridad');
  const { resolveBackupDir } = await import('../lib/storage/backup-dir');
  const b = await resolveBackupDir();
  if (b.source === 'cloud') pass('se guardará copia en tu nube', b.dir.replace(homedir(), '~'));
  else if (b.source === 'env') pass('carpeta de copia configurada a mano', b.dir);
  else advert('Las copias irán a una carpeta local del proyecto',
    'Si quieres copia automática en iCloud, basta con tener iCloud Drive activado en el Mac.');

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`${ok} correcto(s) · ${warn} aviso(s) · ${bad} problema(s)`);
  if (bad === 0 && warn === 0) console.log('Todo listo para analizar partidos. 🎯');
  else if (bad === 0) console.log('Puedes trabajar, pero revisa los avisos de arriba.');
  else console.log('Corrige los ❌ antes de analizar partidos (arriba tienes cómo).');
  console.log('');
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
