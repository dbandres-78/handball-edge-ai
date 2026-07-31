'use client';
import { useState } from 'react';
import { Trash2, Pencil, X } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { ACTIONS, ActionDef, actionByType } from '@/lib/handball/actions';
import { UiEvent, UiTeam, Side, ShotOutcome, ShotOrigin, AttackPhase, EventType } from '@/lib/handball/mapping';
import { ShotOriginCourt, ORIGIN_LABEL } from './ShotOriginCourt';
import { GoalTarget } from './GoalTarget';

const TONE: Record<string, string> = { goal: C.goal, save: C.save, miss: C.miss, neg: C.neg, pos: C.pos, warn: C.warn, neutral: C.neutral };

interface Props {
  events: UiEvent[]; home: UiTeam; away: UiTeam;
  seek: (t: number) => void;
  delEvent: (id: number) => void;
  editEvent: (id: number, patch: Partial<UiEvent>) => void;
}

export function EventLog({ events, home, away, seek, delEvent, editEvent }: Props) {
  const [editing, setEditing] = useState<UiEvent | null>(null);

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, background: C.panel, height: 150 }} className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
        <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>REGISTRO DE JUGADAS</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{events.length} eventos · toca ✎ para corregir</span>
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
                {ev.phase && <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{ev.phase === AttackPhase.COUNTER ? 'contra' : 'posic.'}</span>}
                {ev.zone && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>z{ev.zone}</span>}
                {ev.blockerNumber != null && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.pos }}>bloca #{ev.blockerNumber}</span>
                )}
                {ev.isPenalty && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.warn }}>7m</span>
                )}
                <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(ev)} title="Editar esta jugada" className="w-6 h-6 rounded flex items-center justify-center" style={{ color: C.muted }}><Pencil size={12} /></button>
                  <button onClick={() => delEvent(ev.id)} title="Eliminar" className="w-6 h-6 rounded flex items-center justify-center" style={{ color: C.faint }}><Trash2 size={12} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <EventEditor
          event={editing} home={home} away={away}
          onClose={() => setEditing(null)}
          onSave={(patch) => { editEvent(editing.id, patch); setEditing(null); }}
        />
      )}
    </div>
  );
}

/** Modal para corregir una jugada mal tecleada: equipo, jugador, acción, fase y —en tiros— origen/zona/7m. */
function EventEditor({ event, home, away, onClose, onSave }: {
  event: UiEvent; home: UiTeam; away: UiTeam;
  onClose: () => void; onSave: (patch: Partial<UiEvent>) => void;
}) {
  const initialAction = actionByType(event.type, event.outcome);
  const [side, setSide] = useState<Side>(event.side);
  const [actionKey, setActionKey] = useState<string>(initialAction?.key ?? 'GOL');
  const [player, setPlayer] = useState<number | null>(event.playerNumber);
  const [phase, setPhase] = useState<AttackPhase>(event.phase ?? AttackPhase.POSITIONAL);
  const [origin, setOrigin] = useState<ShotOrigin | null>(event.origin ?? null);
  const [zone, setZone] = useState<number | null>(event.zone ?? null);
  const [isPenalty, setIsPenalty] = useState<boolean>(!!event.isPenalty);

  const action = ACTIONS.find((a) => a.key === actionKey)!;
  const roster = (side === 'HOME' ? home : away).players;
  const accent = side === 'HOME' ? C.home : C.away;
  const carriesPhase = action.type === EventType.SHOT || action.type === EventType.TURNOVER;

  const pickAction = (a: ActionDef) => {
    setActionKey(a.key);
    if (a.teamOnly) setPlayer(null);
    else if (player == null) setPlayer(roster[0]?.number ?? null);
  };

  const save = () => {
    const patch: Partial<UiEvent> = {
      side,
      type: action.type,
      outcome: action.outcome ?? null,
      playerNumber: action.teamOnly ? null : player,
      phase: carriesPhase ? phase : undefined,
    };
    if (action.shot) {
      patch.origin = origin;
      patch.zone = zone;
      patch.isPenalty = isPenalty ? true : undefined;
      patch.blockerNumber = action.outcome === ShotOutcome.BLOCKED ? (event.blockerNumber ?? null) : null;
    } else {
      patch.origin = null; patch.zone = null; patch.isPenalty = undefined; patch.blockerNumber = null;
    }
    onSave(patch);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 60 }}>
      <div className="w-full rounded-xl p-4 flex flex-col gap-3" style={{ maxWidth: 460, maxHeight: '88vh', overflowY: 'auto', background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 700 }}>Editar jugada · {fmt(event.t)}</span>
          <button onClick={onClose} style={{ color: C.faint }}><X size={16} /></button>
        </div>

        {/* Equipo */}
        <div className="grid grid-cols-2 gap-1.5">
          {(['HOME', 'AWAY'] as Side[]).map((sd) => {
            const on = side === sd; const c = sd === 'HOME' ? C.home : C.away;
            return (
              <button key={sd} onClick={() => { setSide(sd); if (!action.teamOnly) setPlayer((sd === 'HOME' ? home : away).players[0]?.number ?? null); }}
                className="py-2 rounded-md text-sm truncate px-2"
                style={{ background: on ? c : C.panel2, color: on ? '#0E1420' : C.muted, border: `1px solid ${on ? c : C.line}`, fontWeight: on ? 700 : 500 }}>
                {(sd === 'HOME' ? home : away).name}
              </button>
            );
          })}
        </div>

        {/* Acción */}
        <div>
          <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>ACCIÓN</div>
          <div className="grid grid-cols-3 gap-1">
            {ACTIONS.filter((a) => a.type !== EventType.NEAR_PASS && a.type !== EventType.TIMEOUT && a.type !== EventType.GOALKEEPER_CHANGE).map((a) => {
              const on = a.key === actionKey;
              return (
                <button key={a.key} onClick={() => pickAction(a)} className="py-1.5 rounded-md text-xs flex items-center justify-center gap-1"
                  style={{ background: on ? C.panel3 : C.panel2, border: `1px solid ${on ? TONE[a.tone] : C.line}`, color: on ? C.text : C.muted, fontWeight: on ? 600 : 500 }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: TONE[a.tone] }} />{a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Jugador */}
        {!action.teamOnly && (
          <div>
            <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>JUGADOR</div>
            <div className="flex flex-wrap gap-1">
              {roster.map((pl) => {
                const on = player === pl.number;
                return (
                  <button key={pl.number} onClick={() => setPlayer(pl.number)} className="w-8 h-7 rounded-md"
                    style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, background: on ? accent : C.panel2, color: on ? '#0E1420' : C.text, border: `1px solid ${on ? accent : C.line}` }}>
                    {pl.number}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fase */}
        {carriesPhase && (
          <div className="grid grid-cols-2 gap-1.5">
            {([[AttackPhase.POSITIONAL, 'Posicional'], [AttackPhase.COUNTER, 'Contraataque']] as const).map(([ph, label]) => {
              const on = phase === ph;
              return (
                <button key={ph} onClick={() => setPhase(ph)} className="py-1.5 rounded-md text-sm"
                  style={{ background: on ? accent : C.panel2, color: on ? '#0E1420' : C.muted, border: `1px solid ${on ? accent : C.line}`, fontWeight: on ? 700 : 500 }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Tiro: origen + zona + 7m */}
        {action.shot && (
          <>
            <div className="p-2 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>Desde dónde lanza</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: origin ? accent : C.faint }}>{origin ? ORIGIN_LABEL[origin] : 'sin zona'}</span>
              </div>
              <div className="flex justify-center"><ShotOriginCourt mode="input" value={origin} onPick={setOrigin} accent={accent} width={230} /></div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
              <GoalTarget mode="input" value={zone} onPick={setZone} accent={accent} size={110} />
              <div className="text-xs" style={{ color: C.muted }}>
                <div style={{ color: C.text, fontWeight: 600, marginBottom: 2 }}>A dónde va</div>
                {zone ? <span style={{ fontFamily: MONO, color: accent }}>Zona {zone}</span> : 'Colocación en portería'}
              </div>
            </div>
            <button onClick={() => setIsPenalty(!isPenalty)} className="flex items-center justify-between p-2 rounded-md w-full"
              style={{ background: isPenalty ? accent : C.panel2, border: `1px solid ${isPenalty ? accent : C.line}` }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: isPenalty ? '#0E1420' : C.text }}>Lanzamiento de 7 metros</span>
              <span className="px-2 py-0.5 rounded" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, background: isPenalty ? '#0E1420' : C.panel, color: isPenalty ? accent : C.faint }}>{isPenalty ? '7M ✓' : '7M'}</span>
            </button>
          </>
        )}

        <div className="flex items-center gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-3 py-2 rounded-md text-sm" style={{ color: C.muted, border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={save} className="px-4 py-2 rounded-md text-sm" style={{ background: C.amber, color: '#0E1420', fontWeight: 700 }}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}
