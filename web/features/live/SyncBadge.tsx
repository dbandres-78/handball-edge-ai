'use client';
import { Check, CloudOff, Loader2, Smartphone, AlertTriangle } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import type { SyncState } from './useMatchPersistence';

/**
 * Estado real del guardado. La regla: no decir "guardado" salvo que el servidor lo haya
 * confirmado. Cuando no hay red, se dice exactamente lo que pasa — que está a salvo en el
 * dispositivo y subirá solo — en vez de fingir que todo va bien.
 */
export function SyncBadge({ state, error, lastSyncedAt }: { state: SyncState; error?: string | null; lastSyncedAt?: number | null }) {
  const hora = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null;

  const view = {
    idle:    { icon: <Check size={12} />,        text: hora ? `Sincronizado ${hora}` : 'Sin cambios', color: C.faint },
    local:   { icon: <Smartphone size={12} />,   text: 'Guardado en el dispositivo',                  color: C.amber },
    syncing: { icon: <Loader2 size={12} className="animate-spin" />, text: 'Sincronizando…',          color: C.muted },
    synced:  { icon: <Check size={12} />,        text: hora ? `Sincronizado ${hora}` : 'Sincronizado', color: C.goal },
    error:   { icon: <CloudOff size={12} />,     text: 'Sin conexión · a salvo en el dispositivo',    color: C.neg },
  }[state];

  return (
    <span className="flex items-center gap-1.5 px-2 py-1 rounded-md"
      title={state === 'error' && error ? `${error} — se reintenta solo` : undefined}
      style={{ fontSize: 11, color: view.color, border: `1px solid ${state === 'error' ? C.neg + '66' : 'transparent'}` }}>
      {view.icon} {view.text}
    </span>
  );
}

/** Aviso al abrir un partido con trabajo local que el servidor nunca llegó a recibir. */
export function RecoveryBanner({ count, onRestore, onDismiss }: { count: number; onRestore: () => void; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2" style={{ background: `${C.amber}14`, borderBottom: `1px solid ${C.amber}44` }}>
      <AlertTriangle size={15} color={C.amber} />
      <span style={{ fontSize: 13, color: C.text }}>
        Hay <b style={{ fontFamily: MONO }}>{count}</b> jugadas guardadas en este dispositivo que el servidor no tiene.
        Probablemente se interrumpió el partido.
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={onRestore} className="px-3 py-1 rounded-md" style={{ background: C.amber, color: '#0E1420', fontWeight: 700, fontSize: 12 }}>
          Recuperarlas
        </button>
        <button onClick={onDismiss} className="px-2 py-1 rounded-md" style={{ color: C.muted, fontSize: 12, border: `1px solid ${C.line}` }}>
          Descartar
        </button>
      </div>
    </div>
  );
}
