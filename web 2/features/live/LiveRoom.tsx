'use client';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ListOrdered, BarChart3, Save, Download, ArrowLeft, Radio } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { ActionDef } from '@/lib/handball/actions';
import { EventType, ShotOrigin, ShotOutcome, UiEvent, UiTeam, Side, liveStats } from '@/lib/handball/mapping';
import type { LoadedMatch } from '@/features/matches/types';
import { TagPanel } from '@/features/analysis/TagPanel';
import { StatsPanel } from '@/features/analysis/StatsPanel';
import { EventLog } from '@/features/analysis/EventLog';
import { extractStats, backupMatch, saveRoster } from '@/features/analysis/actions';
import { toNormalizedMatch } from '@/features/matches/to-normalized';
import { useMatchClock } from './useMatchClock';
import { useMatchPersistence } from './useMatchPersistence';
import { LiveClock } from './LiveClock';
import { SyncBadge, RecoveryBanner } from './SyncBadge';

/**
 * Sala de DIRECTO. Misma capa canónica de eventos, mismo recompute y mismo Play Score que la
 * sala de vídeo: reutiliza TagPanel, StatsPanel y EventLog tal cual. Lo único distinto es el
 * origen del tiempo (reloj corrido en vez del reproductor) y que no hay clips que cortar.
 */
export function LiveRoom({ match }: { match: LoadedMatch }) {
  const idRef = useRef(Math.max(0, ...match.events.map((e) => e.id)) + 1);
  const meta = { matchId: match.matchId, competition: match.competition, matchday: match.matchday, playedAt: match.playedAt };
  const periodMinutes = match.periodMinutes ?? 30;

  const [home, setHome] = useState<UiTeam>(match.home);
  const [away, setAway] = useState<UiTeam>(match.away);
  const [events, setEvents] = useState<UiEvent[]>(match.events);

  const clock = useMatchClock(0);
  const [period, setPeriod] = useState(1);
  const [side, setSide] = useState<Side>('HOME');
  const [player, setPlayer] = useState(match.home.players[1]?.number ?? match.home.players[0]?.number ?? 0);
  const [zone, setZone] = useState<number | null>(null);
  const [origin, setOrigin] = useState<ShotOrigin | null>(null);
  const [blocker, setBlocker] = useState<number | null>(null);
  const [isPenalty, setIsPenalty] = useState(false);

  const [activeGk, setActiveGk] = useState<Record<Side, number | null>>({ HOME: null, AWAY: null });
  const [tab, setTab] = useState<'tag' | 'stats'>('tag');
  const [editRoster, setEditRoster] = useState(false);
  const [statTeam, setStatTeam] = useState<Side>('HOME');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const persistence = useMatchPersistence(match.matchId, match.events);

  const stats = useMemo(() => liveStats(meta, events, home, away), [events, home, away]); // eslint-disable-line react-hooks/exhaustive-deps

  const doFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 1600); };

  // Persistir plantilla/alineación al cambiar (titulares, nombres, porteros). Salta el primer
  // render para no reescribir con lo recién cargado. Best-effort, no bloquea la anotación.
  const rosterFirst = useRef(true);
  useEffect(() => {
    if (rosterFirst.current) { rosterFirst.current = false; return; }
    const id = setTimeout(() => { void saveRoster(match.matchId, home, away); }, 800);
    return () => clearTimeout(id);
  }, [home, away, match.matchId]);

  const tag = (a: ActionDef) => {
    const t = clock.now();                       // instante exacto, no el último tick
    const e: UiEvent = {
      id: idRef.current++, t, period, side,
      playerNumber: a.teamOnly ? null : player,
      type: a.type, outcome: a.outcome ?? null, zone: a.shot ? zone : null,
      origin: a.shot ? origin : null,
      blockerNumber: a.outcome === ShotOutcome.BLOCKED ? blocker : null,
      isPenalty: a.shot && isPenalty ? true : undefined,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);          // 1) dispositivo ya; 2) servidor por detrás
    if (a.shot) { setZone(null); setOrigin(null); setBlocker(null); setIsPenalty(false); }
    // El tiempo muerto para el reloj: es la razón por la que el reloj se detiene en balonmano.
    if (a.type === EventType.TIMEOUT && clock.running) clock.pause();
    doFlash(`${a.label} · ${a.teamOnly ? (side === 'HOME' ? home.name : away.name) : '#' + player} · ${fmt(t)}`);
  };

  const onGkChange = (s: Side, number: number) => {
    if (activeGk[s] === number) return;     // ya está en pista
    setActiveGk((prev) => ({ ...prev, [s]: number }));
    const t = clock.now();
    const e: UiEvent = {
      id: idRef.current++, t, period, side: s,
      playerNumber: number, type: EventType.GOALKEEPER_CHANGE, outcome: null, zone: null,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);
    const teamName = s === 'HOME' ? home.name : away.name;
    doFlash(`Portero en pista · #${number} · ${teamName} · ${fmt(t)}`);
  };

  const recordSub = (s: Side, outN: number, inN: number) => {
    const t = clock.now();
    const e: UiEvent = {
      id: idRef.current++, t, period, side: s,
      playerNumber: inN, type: EventType.SUBSTITUTION, outcome: null, zone: null,
      subOutNumber: outN,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);
    const teamName = s === 'HOME' ? home.name : away.name;
    doFlash(`Cambio · sale #${outN}, entra #${inN} · ${teamName} · ${fmt(t)}`);
  };

  /** Recupera el trabajo local de una sesión interrumpida y lo sube. */
  const restaurar = async () => {
    const snap = persistence.recovered;
    if (!snap) return;
    setEvents(snap.events);
    persistence.dismissRecovered();
    await persistence.record(snap.events);
    doFlash(`${snap.events.length} jugadas recuperadas`);
  };

  const delEvent = (id: number) => {
    const next = events.filter((e) => e.id !== id);
    setEvents(next);
    void persistence.record(next);
  };

  const onSave = useCallback(async () => {
    const ok = await persistence.flush();
    doFlash(ok ? 'Sincronizado con el servidor' : 'Sin conexión — a salvo en el dispositivo');
  }, [persistence]);

  const onFinish = async () => {
    if (clock.running) clock.pause();
    setBusy('extract');
    const subido = await persistence.flush();
    if (!subido) {
      setBusy(null);
      doFlash('No hay conexión: el partido sigue en el dispositivo. Reintenta al recuperar red.');
      return;
    }
    const r = await extractStats(meta.matchId!);
    const copia = await backupMatch(meta.matchId!);      // copia duradera en iCloud/Drive
    setBusy(null);
    doFlash(r.ok
      ? `Partido cerrado · ${r.homeGoals}-${r.awayGoals}${copia.ok ? ' · copia guardada' : ''}`
      : 'No se pudo cerrar');
  };

  const exportMatch = () => {
    const nm = toNormalizedMatch({ ...meta, matchId: meta.matchId!, home, away, events, sourceRef: `directo:${meta.matchId}` });
    const blob = new Blob([JSON.stringify(nm, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `normalized-match-${meta.matchId}.json`; a.click();
    doFlash('NormalizedMatch exportado');
  };

  // Espacio = arrancar/parar el reloj.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); clock.toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clock]);

  return (
    <div style={{ background: C.bg, color: C.text, height: '100vh' }} className="flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
        <Link href="/matches" className="flex items-center gap-1.5" style={{ fontSize: 12, color: C.muted }}>
          <ArrowLeft size={14} /> Biblioteca
        </Link>
        <span style={{ color: C.line }}>/</span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md" style={{ background: `${C.neg}1A`, border: `1px solid ${C.neg}66` }}>
          <Radio size={12} color={C.neg} />
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.neg, fontWeight: 700 }}>DIRECTO</span>
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>{meta.competition}{meta.matchday ? ` · J${meta.matchday}` : ''}</span>

        <div className="flex items-center gap-1.5 ml-auto">
          <SyncBadge state={persistence.state} error={persistence.lastError} lastSyncedAt={persistence.lastSyncedAt} />
          <button onClick={onSave} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted }}>
            <Save size={14} /> Guardar
          </button>
          <button onClick={exportMatch} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted }}>
            <Download size={14} /> Exportar
          </button>
          <button onClick={onFinish} disabled={busy === 'extract'} className="px-3 py-1.5 rounded-md text-sm" style={{ background: C.amber, color: '#0E1420', fontWeight: 700 }}>
            {busy === 'extract' ? 'Cerrando…' : 'Finalizar partido'}
          </button>
        </div>
      </div>

      {persistence.recovered && (
        <RecoveryBanner
          count={persistence.recovered.events.length}
          onRestore={restaurar}
          onDismiss={persistence.dismissRecovered}
        />
      )}

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Reloj + marcador */}
        <div className="flex-1 min-h-0 flex flex-col relative">
          <LiveClock
            seconds={clock.seconds} running={clock.running} onToggle={clock.toggle} onAdjust={clock.adjust}
            onResetPeriod={() => clock.set((period - 1) * periodMinutes * 60)}
            period={period} setPeriod={setPeriod} periodMinutes={periodMinutes}
            homeName={home.name} awayName={away.name}
            homeGoals={stats.summary.home.goals} awayGoals={stats.summary.away.goals}
          />
          {flash && (
            <div className="absolute left-4 bottom-4 px-3 py-1.5 rounded-md text-sm" style={{ background: C.panel2, border: `1px solid ${C.line}`, fontFamily: MONO }}>
              {flash}
            </div>
          )}
        </div>

        {/* Panel de anotación */}
        <div className="lg:w-96 flex flex-col min-h-0" style={{ borderLeft: `1px solid ${C.line}`, background: C.panel }}>
          <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
            {([['tag', 'Anotar', ListOrdered], ['stats', 'Estadística', BarChart3]] as const).map(([k, l, Ic]) => (
              <button key={k} onClick={() => setTab(k)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm"
                style={{ color: tab === k ? C.text : C.muted, fontWeight: tab === k ? 600 : 500, borderBottom: `2px solid ${tab === k ? C.amber : 'transparent'}`, background: tab === k ? C.panel2 : 'transparent' }}>
                <Ic size={15} /> {l}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'tag' ? (
              <TagPanel side={side} setSide={setSide} player={player} setPlayer={setPlayer} period={period} setPeriod={setPeriod}
                zone={zone} setZone={setZone} origin={origin} setOrigin={setOrigin} blocker={blocker} setBlocker={setBlocker} isPenalty={isPenalty} setIsPenalty={setIsPenalty}
                home={home} away={away} setHome={setHome} setAway={setAway}
                editRoster={editRoster} setEditRoster={setEditRoster} tag={tag} time={clock.seconds}
                activeGk={activeGk[side]} onGkChange={onGkChange} events={events} recordSub={recordSub} />
            ) : (
              <StatsPanel stats={stats} statTeam={statTeam} setStatTeam={setStatTeam} expanded={expanded} setExpanded={setExpanded} events={events} />
            )}
          </div>
        </div>
      </div>

      <EventLog events={events} home={home} away={away} seek={() => { /* en directo no hay a dónde saltar */ }} delEvent={delEvent} />
    </div>
  );
}
