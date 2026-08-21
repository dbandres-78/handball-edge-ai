import { mkdir, writeFile, stat, readFile, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Fotos de club y de jugador (para hacer los informes futuros más visuales). Mismo
 * criterio que el vídeo de partido: disco local bajo UPLOAD_DIR (gitignored), pero al
 * ser imágenes pequeñas no hace falta streaming — se leen/escriben enteras en memoria.
 *
 * `photoUrl` guardado en el catálogo es la ruta de SERVIDO (p.ej.
 * /api/catalog/clubs/{id}/photo), no la ruta de disco: la ruta de disco puede tener
 * cualquiera de las extensiones admitidas, así que el GET la busca probándolas.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), '.data', 'uploads');
const PHOTOS_DIR = join(UPLOAD_DIR, 'photos');

export type PhotoKind = 'clubs' | 'players';

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;
const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
};
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
};

/** Límite de tamaño (MB) para una foto — no es vídeo, no hace falta más. */
const MAX_MB = Number(process.env.MAX_PHOTO_MB ?? 8);

const dirFor = (kind: PhotoKind) => join(PHOTOS_DIR, kind);

function extFor(file: File): string | null {
  const fromName = extname(file.name || '').toLowerCase();
  if ((ALLOWED_EXT as readonly string[]).includes(fromName)) return fromName;
  return EXT_BY_MIME[file.type] ?? null;
}

/** Borra cualquier foto existente (probando todas las extensiones) para ese id. */
export async function clearPhoto(kind: PhotoKind, id: string): Promise<void> {
  for (const ext of ALLOWED_EXT) {
    await unlink(join(dirFor(kind), `${id}${ext}`)).catch(() => {});
  }
}

/** Guarda la foto subida, sustituyendo cualquier foto previa (aunque tuviera otra extensión). */
export async function savePhoto(kind: PhotoKind, id: string, file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const ext = extFor(file);
  if (!ext) return { ok: false, error: 'Formato de imagen no admitido (usa JPG, PNG, WEBP o GIF)' };
  if (file.size > MAX_MB * 1024 * 1024) return { ok: false, error: `La imagen supera el límite de ${MAX_MB} MB` };

  await mkdir(dirFor(kind), { recursive: true });
  await clearPhoto(kind, id);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) return { ok: false, error: 'No se recibió contenido de imagen' };
  await writeFile(join(dirFor(kind), `${id}${ext}`), buf);
  return { ok: true };
}

/** Lee la foto de disco (probando extensiones admitidas). null si no hay ninguna. */
export async function readPhoto(kind: PhotoKind, id: string): Promise<{ buf: Buffer; mime: string } | null> {
  for (const ext of ALLOWED_EXT) {
    const p = join(dirFor(kind), `${id}${ext}`);
    const s = await stat(p).catch(() => null);
    if (s) return { buf: await readFile(p), mime: MIME_BY_EXT[ext] };
  }
  return null;
}

/** Ruta pública de servido (determinista) a guardar como `photoUrl` en el catálogo. */
export function photoServingUrl(kind: PhotoKind, id: string): string {
  return `/api/catalog/${kind}/${id}/photo`;
}
