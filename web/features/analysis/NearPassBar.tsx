'use client';
import { PALETTE as C, MONO } from '@/lib/theme';
import { Side } from '@/lib/handball/mapping';

const VIOLET = '#8b5cf6';

/**
 * Barra de «pases a 10 m» (evento de EQUIPO), compartida por directo y vídeo. Suma al equipo que
 * ataca (`side`); se acciona con +1, con −1 para corregir y con la tecla Shift (⇧). Color morado
 * para destacar sobre local/visitante y el ámbar del reloj.
 */
export function NearPassBar({ side, homeName, awayName, homeCount, awayCount, onAdd, onUndo, hint }: {
  side: Side; homeName: string; awayName: string; homeCount: number; awayCount: number;
  onAdd: () => void; onUndo: () => void; hint?: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: `${VIOLET}14`, border: `1.5px solid ${VIOLET}` }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: VIOLET, fontWeight: 700 }}>PASES A 10 M · ATAQUE</span>
        <span style={{ fontSize: 10, color: C.muted }}>⇧ Mayús suma al equipo que atacas</span>
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex-1 rounded-lg py-1.5 text-center min-w-0"
          style={{ background: side === 'HOME' ? `${C.home}22` : C.panel2, border: `1px solid ${side === 'HOME' ? C.home : C.line}` }}>
          <div className="truncate px-1" style={{ fontSize: 10, color: C.muted }}>{homeName}</div>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: side === 'HOME' ? C.home : C.text }}>{homeCount}</div>
        </div>
        <button onClick={onAdd} className="px-5 rounded-lg flex flex-col items-center justify-center"
          style={{ background: VIOLET, color: '#0E1420', fontWeight: 800, minWidth: 92 }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>+1</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>PASE 10M</span>
        </button>
        <div className="flex-1 rounded-lg py-1.5 text-center min-w-0"
          style={{ background: side === 'AWAY' ? `${C.away}22` : C.panel2, border: `1px solid ${side === 'AWAY' ? C.away : C.line}` }}>
          <div className="truncate px-1" style={{ fontSize: 10, color: C.muted }}>{awayName}</div>
          <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: side === 'AWAY' ? C.away : C.text }}>{awayCount}</div>
        </div>
        <button onClick={onUndo} title="Quitar el último pase a 10 m del equipo que atacas"
          className="px-3 rounded-lg" style={{ background: C.panel3, color: C.muted, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 16 }}>
          −1
        </button>
      </div>
      <div className="mt-1.5 text-center" style={{ fontSize: 10, color: C.faint }}>
        {hint ?? <>Atacas: <b style={{ color: side === 'HOME' ? C.home : C.away }}>{side === 'HOME' ? homeName : awayName}</b> · cámbialo en el panel de anotación</>}
      </div>
    </div>
  );
}
