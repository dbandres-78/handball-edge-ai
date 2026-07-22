'use client';
import type { UiEvent } from '@/lib/handball/mapping';

/**
 * Almacén LOCAL del partido (IndexedDB).
 *
 * Es la única capa que no puede fallar: en un pabellón el wifi se cae, y con él se caen tanto el
 * servidor como la nube. Cada acción se escribe aquí en el momento de pulsarla, sin red de por
 * medio. El servidor y la copia en la nube son capas de arriba, con reintentos.
 *
 * Sobrevive a: wifi caído, servidor apagado, pestaña cerrada, recarga y batería.
 */

const DB_NAME = 'handball-edge';
const DB_VERSION = 1;
const STORE = 'matches';

export interface LocalSnapshot {
  matchId: string;
  events: UiEvent[];
  updatedAt: number;
  syncedAt: number | null;   // null = hay cambios que el servidor todavía no tiene
}

const hasIDB = () => typeof window !== 'undefined' && 'indexedDB' in window;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'matchId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

/** Guarda el estado del partido en el dispositivo. Se llama en CADA acción. */
export async function saveLocal(matchId: string, events: UiEvent[], synced = false): Promise<void> {
  if (!hasIDB()) return;
  const prev = await readLocal(matchId).catch(() => null);
  const snap: LocalSnapshot = {
    matchId, events, updatedAt: Date.now(),
    syncedAt: synced ? Date.now() : prev?.syncedAt ?? null,
  };
  await tx('readwrite', (s) => s.put(snap));
}

/** Marca que el servidor ya tiene esta versión. */
export async function markSynced(matchId: string): Promise<void> {
  if (!hasIDB()) return;
  const snap = await readLocal(matchId);
  if (!snap) return;
  await tx('readwrite', (s) => s.put({ ...snap, syncedAt: Date.now() }));
}

export async function readLocal(matchId: string): Promise<LocalSnapshot | null> {
  if (!hasIDB()) return null;
  try { return (await tx<LocalSnapshot>('readonly', (s) => s.get(matchId))) ?? null; }
  catch { return null; }
}

export async function clearLocal(matchId: string): Promise<void> {
  if (!hasIDB()) return;
  await tx('readwrite', (s) => s.delete(matchId));
}

/**
 * ¿Hay trabajo local que el servidor no tiene? Se usa al abrir la sala para detectar un partido
 * interrumpido (se fue la luz, se cerró el portátil) y ofrecer recuperarlo.
 */
export function isPending(snap: LocalSnapshot | null): boolean {
  if (!snap) return false;
  return snap.syncedAt == null || snap.syncedAt < snap.updatedAt;
}
