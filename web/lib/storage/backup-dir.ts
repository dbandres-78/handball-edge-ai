import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Carpeta donde dejar la copia duradera del partido.
 *
 * Se escribe un FICHERO en una carpeta sincronizada (iCloud Drive, Google Drive…) en vez de llamar
 * a la API de la nube, por una razón concreta: sin red, la API falla y el fichero no. El cliente
 * de escritorio sube la copia solo cuando vuelva la conexión. Además, iCloud Drive no ofrece API
 * web general, así que la carpeta es la única vía sensata.
 */
const CANDIDATES = [
  join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs'),   // iCloud Drive (macOS)
  join(homedir(), 'Library', 'CloudStorage'),                              // Google Drive / OneDrive (macOS)
  join(homedir(), 'Google Drive'),
  join(homedir(), 'iCloud Drive'),
  join(homedir(), 'OneDrive'),
];

export type BackupSource = 'env' | 'cloud' | 'local';

async function exists(p: string): Promise<boolean> {
  try { await readdir(p); return true; } catch { return false; }
}

/** BACKUP_DIR manda; si no, se autodetecta la nube; si no, carpeta local del proyecto. */
export async function resolveBackupDir(): Promise<{ dir: string; source: BackupSource }> {
  if (process.env.BACKUP_DIR) return { dir: process.env.BACKUP_DIR, source: 'env' };
  for (const base of CANDIDATES) {
    if (await exists(base)) return { dir: join(base, 'HandballEdge'), source: 'cloud' };
  }
  return { dir: join(process.cwd(), '.data', 'backups'), source: 'local' };
}
