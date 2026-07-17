'use client';
import { Trash2 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { actionByType } from '@/lib/handball/actions';
import { UiEvent, UiTeam } from '@/lib/handball/mapping';

const TONE: Record<string, string> = { goal: C.goal, save: C.save, miss: C.miss, neg: C.neg, pos: C.pos, warn: C.warn, neutral: C.neutral };

interface Props { events: UiEvent[]; home: UiTeam; away: UiTeam; seek: (t: number) => void; delEvent: (id: number) => void }

export function EventLog({ events, home, away, seek, delEvent }: Props) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, background: C.panel, height: 150 }} className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>REGISTRO DE JUGADAS</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{events.length} eventos</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center" style={{ color: C.faint, fontSize: 13 }}>
            Selecciona un jugador y marca una acción para empezar a registrar el partido.
          </div>
        ) : (
          [...events].reverse().map((ev) => {
            const a = actionByType(ev.type, ev.outcome);
            const teamName = ev.side === 'HOME' ? home.name : away.name;
            const col = ev.side === 'HOME' ? C.home : C.away;
            return (
              <div key={ev.id} className="flex items-center gap-2 px-3 py-1" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <button onClick={() => seek(ev.t)} className="px-1.5 py-0.5 rounded" style={{ fontFamily: MONO, fontSize: 12, color: C.amber, background: C.bg, border: `1px solid ${C.line}` }}>{fmt(ev.t)}</button>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>P{ev.period}</span>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col }} />
                <span className="truncate" style={{ fontSize: 12, color: C.muted, maxWidth: 130 }}>{teamName}</span>
                {ev.playerNumber != null && <span style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>#{ev.playerNumber}</span>}
                <span className="flex items-center gap-1.5" style={{ fontSize: 13, color: C.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: a ? TONE[a.tone] : C.faint }} />{a?.label}
                </span>
                {ev.zone && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>z{ev.zone}</span>}
                {ev.blockerNumber != null && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.pos }}>bloca #{ev.blockerNumber}</span>
                )}
                <button onClick={() => delEvent(ev.id)} className="ml-auto w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ color: C.faint }}><Trash2 size={12} /></button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
