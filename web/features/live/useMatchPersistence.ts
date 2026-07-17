'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiEvent } from '@/lib/handball/mapping';
import { saveEvents } from '@/features/analysis/actions';
import { saveLocal, markSynced, readLocal, isPending, LocalSnapshot } from '@/lib/storage/local-store';

/**
 * Persistencia del partido en tres capas:
 *   1. dispositivo (IndexedDB) — inmediata, sin red. Nunca se pierde nada.
 *   2. servidor        — en segundo plano, con reintentos y espera creciente.
 *   3. nube            — copia duradera (se dispara aparte, al finalizar o a mano).
 *
 * El estado que se muestra es el REAL: si el servidor no ha confirmado, no se dice "guardado".
 */

export type SyncState =
  | 'idle'          // sin cambios pendientes; servidor al día
  | 'local'         // guardado en el dispositivo, pendiente de subir
  | 'syncing'
  | 'synced'
  | 'error';        // el servidor rechazó o no hay red

const BACKOFF = [1000, 2000, 5000, 10000, 20000, 30000];

export function useMatchPersistence(matchId: string, events: UiEvent[]) {
  const [state, setState] = useState<SyncState>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [recovered, setRecovered] = useState<LocalSnapshot | null>(null);

  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEvents = useRef<UiEvent[]>(events);
  const dirty = useRef(false);

  // Al abrir: ¿hay trabajo local sin subir de una sesión anterior?
  useEffect(() => {
    let alive = true;
    readLocal(matchId).then((snap) => {
      if (alive && isPending(snap)) setRecovered(snap);
    });
    return () => { alive = false; };
  }, [matchId]);

  const push = useCallback(async () => {
    if (!dirty.current) return;
    setState('syncing');
    const res = await saveEvents(matchId, pendingEvents.current);
    if (res.ok) {
      dirty.current = false;
      attempt.current = 0;
      await markSynced(matchId);
      setLastSyncedAt(Date.now());
      setLastError(null);
      setState('synced');
      return;
    }
    // Falló: los datos siguen a salvo en el dispositivo. Reintentar con espera creciente.
    setLastError(res.error ?? 'Error desconocido');
    setState('error');
    const wait = BACKOFF[Math.min(attempt.current, BACKOFF.length - 1)];
    attempt.current++;
    timer.current = setTimeout(() => { void push(); }, wait);
  }, [matchId]);

  /** Se llama en CADA acción: primero al dispositivo, luego se programa la subida. */
  const record = useCallback(async (next: UiEvent[]) => {
    pendingEvents.current = next;
    dirty.current = true;
    await saveLocal(matchId, next, false);
    setState((s) => (s === 'error' ? 'error' : 'local'));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void push(); }, 1200);   // agrupa ráfagas de acciones
  }, [matchId, push]);

  /** Subida inmediata (botón Guardar / finalizar partido). */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    dirty.current = true;
    await saveLocal(matchId, pendingEvents.current, false);
    setState('syncing');
    const res = await saveEvents(matchId, pendingEvents.current);
    if (res.ok) {
      dirty.current = false; attempt.current = 0;
      await markSynced(matchId);
      setLastSyncedAt(Date.now()); setLastError(null); setState('synced');
      return true;
    }
    setLastError(res.error ?? 'Error desconocido'); setState('error');
    return false;
  }, [matchId]);

  // Al recuperar la red, reintentar de inmediato.
  useEffect(() => {
    const onOnline = () => { if (dirty.current) { attempt.current = 0; void push(); } };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [push]);

  // Aviso al cerrar si el servidor aún no lo tiene (en el dispositivo sí está).
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { state, lastError, lastSyncedAt, record, flush, recovered, dismissRecovered: () => setRecovered(null) };
}
