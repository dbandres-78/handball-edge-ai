'use client';
import { useEffect } from 'react';
import { X, SkipForward } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { ActionDef, TACTICAL_CONTEXTS, TACTICAL_CONTEXT_LABEL } from '@/lib/handball/actions';
import { TacticalContext } from '@/lib/handball/mapping';

interface Props {
  /** Acción pendiente de cerrar (ya elegida: gol, pérdida, etc.). Solo para mostrar contexto. */
  action: ActionDef;
  playerLabel: string;
  accent: string;
  /** Elige una combinación: cierra la acción con ese contexto. */
  onPick: (ctx: TacticalContext) => void;
  /** Salta el paso: cierra la acción sin clasificar (tacticalContext = null). */
  onSkip: () => void;
  /** Cancela: no cierra la acción, vuelve a la anotación. */
  onCancel: () => void;
}

/**
 * Paso OPCIONAL entre elegir el desenlace (gol/fallo/pérdida…) y cerrar definitivamente la
 * jugada: clasifica la combinación táctica que la generó. Un único toque en cualquiera de las
 * 4 opciones cierra la acción; "Omitir" la cierra sin clasificar (no es obligatorio saltarse
 * agilidad por esto). "Cancelar" vuelve atrás sin anotar nada.
 */
export function TacticalContextModal({ action, playerLabel, accent, onPick, onSkip, onCancel }: Props) {
  // Esc = omitir (rápido, no bloquea la agilidad de la anotación en directo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onSkip(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.75)', zIndex: 70 }}>
      <div className="w-full rounded-xl p-4 flex flex-col gap-3" style={{ maxWidth: 380, background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>¿Cómo se generó la jugada?</div>
            <div style={{ fontSize: 11, color: C.faint }}>
              {action.label} · {playerLabel} — opcional, se puede saltar
            </div>
          </div>
          <button onClick={onCancel} title="Cancelar (no anotar nada)" style={{ color: C.faint }}><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TACTICAL_CONTEXTS.map((ctx) => (
            <button key={ctx} onClick={() => onPick(ctx)}
              className="py-4 rounded-lg text-sm flex flex-col items-center justify-center gap-1"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontWeight: 600 }}
              onMouseDown={(e) => e.preventDefault()}>
              {TACTICAL_CONTEXT_LABEL[ctx]}
            </button>
          ))}
        </div>

        <button onClick={onSkip} autoFocus
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm"
          style={{ background: accent, color: '#0E1420', fontWeight: 700 }}>
          <SkipForward size={15} /> Omitir · anotar sin clasificar
        </button>
        <div style={{ fontSize: 10, color: C.faint, fontFamily: MONO, textAlign: 'center' }}>
          Esc = omitir y anotar · ✕ = cancelar sin anotar
        </div>
      </div>
    </div>
  );
}
