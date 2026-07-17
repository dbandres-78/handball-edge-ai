'use client';
import { useMemo } from 'react';
import { Shield, ChevronRight } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { TERM_ES } from '@/lib/handball/actions';
import { LiveStats, Side, UiEvent, EventType, ShotOutcome } from '@/lib/handball/mapping';
import { GoalTarget } from './GoalTarget';
import { ShotOriginCourt } from './ShotOriginCourt';

interface Props {
  stats: LiveStats;
  statTeam: Side; setStatTeam: (s: Side) => void;
  expanded: string | null; setExpanded: (v: string | null) => void;
  events: UiEvent[];
}

export function StatsPanel(p: Props) {
  const s = p.statTeam === 'HOME' ? p.stats.summary.home : p.stats.summary.away;
  const accent = p.statTeam === 'HOME' ? C.home : C.away;
  const players = p.stats.players
    .filter((pl) => pl.side === p.statTeam)
    .sort((a, b) => b.playScore.total - a.playScore.total || b.goals - a.goals);
  const eff = s.shots ? Math.round((s.goals / s.shots) * 100) : 0;

  const originHeat = useMemo(() => {
    const out: Record<string, { shots: number; goals: number }> = {};
    for (const [zone, c] of Object.entries(s.byOrigin)) {
      if (c) out[zone] = { shots: c.shots, goals: c.goals };
    }
    return out;
  }, [s.byOrigin]);
  const shotsWithOrigin = useMemo(
    () => Object.values(s.byOrigin).reduce((acc, c) => acc + (c?.shots ?? 0), 0),
    [s.byOrigin],
  );

  const goalZones = useMemo(() => {
    const z: Record<number, number> = {};
    p.events.filter((e) => e.side === p.statTeam && e.type === EventType.SHOT && e.outcome === ShotOutcome.GOAL && e.zone)
      .forEach((e) => { z[e.zone!] = (z[e.zone!] || 0) + 1; });
    return z;
  }, [p.events, p.statTeam]);

  const Metric = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="p-2 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: C.faint }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: C.text }}>{value}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{sub}</span></div>
    </div>
  );

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        {(['HOME', 'AWAY'] as Side[]).map((sd) => (
          <button key={sd} onClick={() => p.setStatTeam(sd)} className="flex-1 py-2 text-sm truncate px-2"
            style={{ background: p.statTeam === sd ? (sd === 'HOME' ? C.home : C.away) : 'transparent', color: p.statTeam === sd ? '#0E1420' : C.muted, fontWeight: 600 }}>
            {(sd === 'HOME' ? p.stats.summary.home : p.stats.summary.away).name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <Metric label="GOLES" value={s.goals} />
        <Metric label="TIROS" value={s.shots} />
        <Metric label="EFIC." value={eff} sub="%" />
        <Metric label="PARADAS" value={s.saves} />
        <Metric label="SAVE %" value={s.savePct != null ? Math.round(s.savePct * 1000) / 10 : '—'} sub={s.savePct != null ? '%' : ''} />
        <Metric label="PÉRD." value={s.turnovers} />
        <Metric label="RECUP." value={s.steals} />
        <Metric label="BLOCAJES" value={s.blocks} />
        <Metric label="EXCL. 2′" value={s.twoMinutes} />
        <Metric label="T.M." value={s.timeouts} />
      </div>

      {/* Desde dónde se tira: base del xG */}
      <div className="p-3 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>MAPA DE LANZAMIENTO</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{shotsWithOrigin} tiros ubicados</span>
        </div>
        <div className="flex justify-center py-1">
          <ShotOriginCourt mode="display" heat={originHeat} accent={accent} width={230} />
        </div>
        <div className="flex items-center justify-center gap-3" style={{ fontSize: 10, color: C.faint }}>
          <span>goles/tiros por zona</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: C.goal }} />≥60%</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: C.amber }} />≥35%</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: C.neg }} />&lt;35%</span>
        </div>
        <div style={{ fontSize: 10, color: C.faint, marginTop: 4, textAlign: 'center' }}>
          Eficacia por posición de tiro — la materia prima del xG.
        </div>
      </div>

      {/* A dónde va: base del xGOT */}
      <div className="flex items-center gap-3 p-3 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <GoalTarget mode="display" counts={goalZones} accent={accent} size={116} />
        <div>
          <div style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>MAPA DE GOL</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Goles por zona de portería</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: accent, marginTop: 4 }}>
            {Object.values(goalZones).reduce((a, b) => a + b, 0)}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}> con zona</span>
          </div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>Colocación — base del xGOT.</div>
        </div>
      </div>

      <div className="rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        <div className="grid items-center px-2 py-1.5" style={{ gridTemplateColumns: '28px 1fr 26px 26px 26px 26px 52px', background: C.panel2, fontSize: 10, letterSpacing: 0.5, color: C.faint }}>
          <span>#</span><span>JUGADOR</span>
          <span className="text-center" title="Goles">G</span>
          <span className="text-center" title="Pérdidas">P</span>
          <span className="text-center" title="Defensa: recuperaciones + blocajes">D</span>
          <span className="text-center" title="Paradas">★</span>
          <span className="text-right">PS</span>
        </div>
        {players.map((pl) => {
          const key = `${p.statTeam}-${pl.number}`;
          const open = p.expanded === key;
          const ps = pl.playScore.total;
          return (
            <div key={pl.number}>
              <button onClick={() => p.setExpanded(open ? null : key)} className="grid items-center px-2 py-1.5 w-full text-left"
                style={{ gridTemplateColumns: '28px 1fr 26px 26px 26px 26px 52px', borderTop: `1px solid ${C.lineSoft}`, background: open ? C.panel2 : 'transparent' }}>
                <span style={{ fontFamily: MONO, color: accent, fontWeight: 700 }}>{pl.number}</span>
                <span className="truncate flex items-center gap-1" style={{ fontSize: 13 }}>{pl.position === 'GK' && <Shield size={11} color={C.amber} />}{pl.name}</span>
                <span className="text-center" style={{ fontFamily: MONO, fontSize: 13 }}>{pl.goals}</span>
                <span className="text-center" style={{ fontFamily: MONO, fontSize: 13, color: C.muted }}>{pl.turnovers}</span>
                <span className="text-center" style={{ fontFamily: MONO, fontSize: 13, color: C.pos }}>{pl.steals + pl.blocks || ''}</span>
                <span className="text-center" style={{ fontFamily: MONO, fontSize: 13, color: C.save }}>{pl.saves || ''}</span>
                <span className="text-right flex items-center justify-end gap-1" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: ps > 0 ? C.goal : ps < 0 ? C.neg : C.muted }}>
                  {ps > 0 ? '+' : ''}{ps}<ChevronRight size={12} color={C.faint} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                </span>
              </button>
              {open && (
                <div className="px-3 py-2" style={{ background: C.bg, borderTop: `1px solid ${C.lineSoft}` }}>
                  {pl.playScore.breakdown.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.faint }}>Sin acciones que puntúen todavía.</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {pl.playScore.breakdown.map((t) => (
                        <div key={t.term} className="flex items-center justify-between" style={{ fontFamily: MONO, fontSize: 12 }}>
                          <span className="flex items-center gap-1" style={{ color: C.muted }}>
                            {TERM_ES[t.term] ?? t.term}
                            {t.origin === 'prior' && (
                              <span title="Peso experto, aún sin calibrar" style={{ fontSize: 9, color: C.amber, border: `1px solid ${C.line}`, borderRadius: 3, padding: '0 3px' }}>prior</span>
                            )}
                          </span>
                          <span style={{ color: C.faint }}>{t.count} × {t.weight > 0 ? '+' : ''}{t.weight}</span>
                          <span style={{ color: t.contribution > 0 ? C.goal : C.neg, width: 48, textAlign: 'right' }}>{t.contribution > 0 ? '+' : ''}{t.contribution}</span>
                        </div>
                      ))}
                      {pl.playScore.priorTotal !== 0 && (
                        <div className="flex items-center justify-between" style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>
                          <span>ajustado {pl.playScore.fittedTotal > 0 ? '+' : ''}{pl.playScore.fittedTotal}</span>
                          <span>prior {pl.playScore.priorTotal > 0 ? '+' : ''}{pl.playScore.priorTotal}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 mt-0.5" style={{ fontFamily: MONO, fontSize: 12, borderTop: `1px solid ${C.lineSoft}` }}>
                        <span style={{ color: C.text, fontWeight: 600 }}>Play Score</span>
                        <span style={{ color: C.text, fontWeight: 700 }}>{ps > 0 ? '+' : ''}{ps}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs px-1" style={{ color: C.faint }}>
        Play Score: núcleo ajustado por regresión (gol +1.8, fallo −1.0, pérdida −0.55, parada +1.84) más
        términos defensivos marcados <span style={{ color: C.amber }}>prior</span> (recuperación, blocaje,
        exclusión…), que son pesos expertos pendientes de calibrar con datos propios.
      </div>
    </div>
  );
}
