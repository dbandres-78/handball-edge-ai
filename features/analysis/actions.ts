import type { UiEvent, UiClip, UiTeam } from '@/lib/handball/mapping';

export interface SaveResult { ok: boolean; error?: string }

/** Persiste plantillas y alineación (titulares). Best-effort: no bloquea el etiquetado. */
export async function saveRoster(matchId: string, home: UiTeam, away: UiTeam): Promise<boolean> {
  try {
    const r = await fetch(`/api/matches/${matchId}/roster`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ home, away }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Guarda en el servidor y DICE LA VERDAD sobre el resultado.
 * Antes se ignoraba el fallo y la UI cantaba "Guardado" igualmente: en un pabellón con mala
 * cobertura eso significa perder el partido creyendo que está a salvo.
 */
export async function saveEvents(matchId: string, events: UiEvent[]): Promise<SaveResult> {
  try {
    const r = await fetch(`/api/matches/${matchId}/events`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, error: data.error ?? `El servidor respondió ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Sin conexión con el servidor' };
  }
}

export interface BackupResult { ok: boolean; path?: string; error?: string }

/** Copia duradera del partido en la carpeta sincronizada (iCloud/Drive). */
export async function backupMatch(matchId: string): Promise<BackupResult> {
  try {
    const r = await fetch(`/api/matches/${matchId}/backup`, { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, path: data.path } : { ok: false, error: data.error ?? `Error ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface ExtractResult { ok: boolean; matchId: string; homeGoals: number; awayGoals: number }
export async function extractStats(matchId: string): Promise<ExtractResult> {
  const r = await fetch(`/api/matches/${matchId}/stats`, { method: 'POST' });
  return r.json();
}

export interface UploadResult { ok: boolean; videoRef?: string; durationSec?: number; sizeBytes?: number; error?: string }
export async function uploadVideo(matchId: string, file: File): Promise<UploadResult> {
  // Enviamos el binario crudo por streaming (el body es el propio File, no FormData).
  // El servidor lo vuelca a disco chunk a chunk sin cargarlo entero en RAM.
  // La extensión viaja por query porque el body ya no lleva el nombre del archivo.
  const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.mp4').toLowerCase();
  const r = await fetch(`/api/matches/${matchId}/video?ext=${encodeURIComponent(ext)}`, {
    method: 'POST',
    body: file,
    headers: { 'content-type': file.type || 'application/octet-stream' },
    // @ts-expect-error — duplex es necesario para enviar un stream como body (Node/fetch).
    duplex: 'half',
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, ...data };
}

export type CutMode = 'fast' | 'accurate';

export interface StartRenderResult { ok: boolean; jobId?: string; total?: number; message?: string; status: number }
export async function startRender(matchId: string, clips: UiClip[], mode: CutMode = 'accurate'): Promise<StartRenderResult> {
  const r = await fetch('/api/clips/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ matchId, mode, clips: clips.map((c) => ({ in: c.in, out: c.out, label: c.label })) }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...data };
}

export interface RenderClipView {
  index: number; label: string; in: number; out: number;
  status: 'pending' | 'done' | 'error'; durationSec?: number; error?: string; downloadUrl?: string | null;
}
export interface RenderJobView {
  id: string; status: 'queued' | 'running' | 'done' | 'error';
  total: number; completed: number; clips: RenderClipView[];
}
export async function getRenderJob(jobId: string): Promise<RenderJobView | null> {
  const r = await fetch(`/api/clips/render/${jobId}`);
  if (!r.ok) return null;
  return r.json();
}
