'use client';
import { Shield, Pencil, X, Plus } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { ACTIONS, ActionDef, Tone } from '@/lib/handball/actions';
import { UiTeam, Side, ShotOrigin } from '@/lib/handball/mapping';
import { GoalTarget } from './GoalTarget';
import { ShotOriginCourt, ORIGIN_LABEL } from './ShotOriginCourt';

const TONE: Record<Tone, string> = { goal: C.goal, save: C.save, miss: C.miss, neg: C.neg, pos: C.pos, warn: C.warn, neutral: C.neutral };

interface Props {
  side: Side; setSide: (s: Side) => void;
  player: number; setPlayer: (n: number) => void;
  period: number; setPeriod: (p: number) => void;
  zone: number | null; setZone: (z: number | null) => void;
  origin: ShotOrigin | null; setOrigin: (o: ShotOrigin | null) => void;
  blocker: number | null; setBlocker: (n: number | null) => void;
  home: UiTeam; away: UiTeam;
  setHome: (t: UiTeam) => void; setAway: (t: UiTeam) => void;
  editRoster: boolean; setEditRoster: (v: boolean) => void;
  tag: (a: ActionDef) => void; time: number;
  /** Portero actualmente en pista del equipo seleccionado (dorsal). */
  activeGk?: number | null;
  /** Callback al cambiar de portero en pista. */
  onGkChange?: (side: Side, number: number) => void;
}

/** Máximo jugadores por equipo (RFEBM). */
const MAX_PLAYERS = 16;
/** Rango de dorsales válidos. */
const MIN_DORSAL = 1;
const MAX_DORSAL = 100;

export function TagPanel(p: Props) {
  const team = p.side === 'HOME' ? p.home : p.away;
  const setTeam = p.side === 'HOME' ? p.setHome : p.setAway;
  const accent = p.side === 'HOME' ? C.home : C.away;
  const rival = p.side === 'HOME' ? p.away : p.home;
  const rivalAccent = p.side === 'HOME' ? C.away : C.home;

  const updatePlayer = (i: number, patch: Partial<UiTeam['players'][number]>) => {
    // gk es ahora "es portero" (puede haber varios), no exclusivo. No limpiamos gk de los demás.
    setTeam({ ...team, players: team.players.map((pl, k) => (k === i ? { ...pl, ...patch } : pl)) });
  };
  const addPlayer = () => {
    if (team.players.length >= MAX_PLAYERS) return; // tope RFEBM
    setTeam({ ...team, players: [...team.players, { number: 0, name: 'Nuevo' }] });
  };
  const rmPlayer = (i: number) => setTeam({ ...team, players: team.players.filter((_, k) => k !== i) });
  const clampDorsal = (v: number) => Math.max(MIN_DORSAL, Math.min(MAX_DORSAL, v));

  const goalkeepers = team.players.filter((pl) => pl.gk);
  const currentGk = p.activeGk ?? goalkeepers[0]?.number;

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        {(['HOME', 'AWAY'] as Side[]).map((s) => (
          <button key={s} onClick={() => p.setSide(s)} className="flex-1 py-2 text-sm truncate px-2"
            style={{ background: p.side === s ? (s === 'HOME' ? C.home : C.away) : 'transparent', color: p.side === s ? '#0E1420' : C.muted, fontWeight: 600 }}>
            {(s === 'HOME' ? p.home : p.away).name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span style={{ fontSize: 11, color: C.faint, marginRight: 4 }}>PARTE</span>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} onClick={() => p.setPeriod(n)} className="w-7 h-7 rounded-md text-sm"
              style={{ fontFamily: MONO, background: p.period === n ? C.panel3 : C.panel, color: p.period === n ? C.text : C.muted, border: `1px solid ${C.line}` }}>{n}</button>
          ))}
        </div>
        <button onClick={() => p.setEditRoster(!p.editRoster)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ color: p.editRoster ? C.amber : C.muted, border: `1px solid ${C.line}` }}>
          <Pencil size={12} /> Plantillas
        </button>
      </div>

      {p.editRoster ? (
        <div className="flex flex-col gap-1.5">
          <input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} className="px-2 py-1.5 rounded-md text-sm w-full" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.text }} />
          {team.players.map((pl, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={pl.number} onChange={(e) => updatePlayer(i, { number: clampDorsal(Number(e.target.value) || MIN_DORSAL) })} className="w-12 px-1.5 py-1 rounded-md text-sm text-center" style={{ fontFamily: MONO, background: C.bg, border: `1px solid ${C.line}`, color: C.text }} />
              <input value={pl.name} onChange={(e) => updatePlayer(i, { name: e.target.value })} className="flex-1 px-2 py-1 rounded-md text-sm" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.text }} />
              <button onClick={() => updatePlayer(i, { gk: !pl.gk })} title="Portero" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: pl.gk ? accent : C.panel, color: pl.gk ? '#0E1420' : C.muted, border: `1px solid ${C.line}` }}><Shield size={13} /></button>
              <button onClick={() => rmPlayer(i)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ color: C.faint, border: `1px solid ${C.line}` }}><X size={13} /></button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button onClick={addPlayer} disabled={team.players.length >= MAX_PLAYERS}
              className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-md text-sm"
              style={{ color: team.players.length >= MAX_PLAYERS ? C.faint : C.muted, border: `1px dashed ${C.line}`, opacity: team.players.length >= MAX_PLAYERS ? 0.5 : 1 }}>
              <Plus size={13} /> Añadir jugador
            </button>
            <span style={{ fontSize: 10, color: C.faint }}>{team.players.length}/{MAX_PLAYERS}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {team.players.map((pl) => (
            <button key={pl.number} onClick={() => p.setPlayer(pl.number)} className="relative py-2 rounded-md flex flex-col items-center"
              style={{ background: p.player === pl.number ? accent : C.panel2, border: `1px solid ${p.player === pl.number ? accent : C.line}`, color: p.player === pl.number ? '#0E1420' : C.text }}>
              {pl.gk && <Shield size={10} className="absolute top-1 right-1" color={p.player === pl.number ? '#0E1420' : C.amber} />}
              <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>{pl.number}</span>
              <span className="truncate" style={{ fontSize: 9, opacity: 0.8, maxWidth: 60 }}>{pl.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Portero en pista: solo visible si hay ≥2 porteros en la plantilla */}
      {goalkeepers.length >= 2 && (
        <div className="p-2.5 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>Portero en pista</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{team.name}</span>
          </div>
          <div className="flex gap-1.5">
            {goalkeepers.map((gk) => (
              <button key={gk.number} onClick={() => p.onGkChange?.(p.side, gk.number)}
                className="flex-1 py-2 rounded-md flex flex-col items-center gap-0.5"
                style={{
                  background: currentGk === gk.number ? accent : C.panel,
                  color: currentGk === gk.number ? '#0E1420' : C.muted,
                  border: `1px solid ${currentGk === gk.number ? accent : C.line}`,
                  fontWeight: currentGk === gk.number ? 700 : 500,
                }}>
                <Shield size={14} />
                <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>{gk.number}</span>
                <span className="truncate" style={{ fontSize: 9, maxWidth: 70 }}>{gk.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desde dónde se lanza (xG) */}
      <div className="p-2.5 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>Desde dónde lanza</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: p.origin ? accent : C.faint }}>
            {p.origin ? ORIGIN_LABEL[p.origin] : 'sin zona'}
          </span>
        </div>
        <div className="flex justify-center">
          <ShotOriginCourt mode="input" value={p.origin} onPick={p.setOrigin} accent={accent} width={210} />
        </div>
      </div>

      {/* A dónde va el balón (xGOT) */}
      <div className="flex items-center gap-3 p-2.5 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <GoalTarget mode="input" value={p.zone} onPick={p.setZone} accent={accent} size={100} />
        <div className="text-xs" style={{ color: C.muted }}>
          <div style={{ color: C.text, fontWeight: 600, marginBottom: 2 }}>A dónde va</div>
          {p.zone
            ? <span style={{ fontFamily: MONO, color: accent }}>Zona {p.zone} de portería</span>
            : 'Colocación del tiro en la portería'}
        </div>
      </div>

      {/* Autor del blocaje: sin él, «Blocado» no puntúa a ningún defensor. */}
      <div className="p-2.5 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>¿Quién bloca?</span>
          <span style={{ fontSize: 10, color: C.faint }}>{rival.name}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {rival.players.filter((pl) => !pl.gk).map((pl) => (
            <button key={pl.number} onClick={() => p.setBlocker(p.blocker === pl.number ? null : pl.number)}
              className="w-8 h-7 rounded-md"
              style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700,
                background: p.blocker === pl.number ? rivalAccent : C.panel,
                color: p.blocker === pl.number ? '#0E1420' : C.muted,
                border: `1px solid ${p.blocker === pl.number ? rivalAccent : C.line}` }}>
              {pl.number}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>
          Opcional — solo aplica a «Blocado». Sin defensor, el blocaje no se atribuye.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {ACTIONS.map((a) => (
          <button key={a.key} onClick={() => p.tag(a)} className="py-2.5 rounded-md text-sm flex items-center justify-center gap-1.5" style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontWeight: 500 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: TONE[a.tone] }} />{a.label}
          </button>
        ))}
      </div>
      <div className="text-center" style={{ fontSize: 11, color: C.faint }}>
        Sella en <span style={{ fontFamily: MONO, color: C.amber }}>{fmt(p.time)}</span> · jugador #{p.player} · {team.name}
      </div>
    </div>
  );
}
