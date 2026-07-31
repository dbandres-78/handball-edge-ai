'use client';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { ListOrdered, Scissors, BarChart3 } from 'lucide-react';
import { PALETTE as C } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { ActionDef, ACTIONS } from '@/lib/handball/actions';
import {
  EventType, ShotOrigin, ShotOutcome, UiEvent, UiClip, UiTeam, Side, liveStats, AttackPhase,
} from '@/lib/handball/mapping';
import {
  deriveClips, DEFAULT_CLIP_WINDOW, DerivedClip, ClipFilter, ClipWindow, ClipOverride,
} from '@/lib/handball/clips';
import type { LoadedMatch } from '@/features/matches/types';
import { Scoreboard } from './Scoreboard';
import { VideoStage } from './VideoStage';
import { TagPanel } from './TagPanel';
import { ClipsPanel } from './ClipsPanel';
import { StatsPanel } from './StatsPanel';
import { EventLog } from './EventLog';
import { NearPassBar } from './NearPassBar';
import { extractStats, uploadVideo, startRender, getRenderJob, RenderJobView, saveRoster } from './actions';
import { toNormalizedMatch } from '@/features/matches/to-normalized';
import { useMatchPersistence } from '@/features/live/useMatchPersistence';

/** Pase a 10 m (evento de equipo). En vídeo, Shift (⇧) lo suma; el espacio es play/pausa. */
const NEAR_PASS_ACTION = ACTIONS.find((a) => a.type === EventType.NEAR_PASS)!;

export function AnalysisRoom({ match }: { match: LoadedMatch }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const idRef = useRef(Math.max(0, ...match.events.map((e) => e.id)) + 1);
  const clipStopRef = useRef<number | null>(null);

  const meta = { matchId: match.matchId, competition: match.competition, matchday: match.matchday, playedAt: match.playedAt };
  const [home, setHome] = useState<UiTeam>(match.home);
  const [away, setAway] = useState<UiTeam>(match.away);
  const [events, setEvents] = useState<UiEvent[]>(match.events);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const [side, setSide] = useState<Side>('HOME');
  const [player, setPlayer] = useState(match.home.players[1]?.number ?? match.home.players[0]?.number ?? 0);
  const [period, setPeriod] = useState(1);
  const [zone, setZone] = useState<number | null>(null);
  const [origin, setOrigin] = useState<ShotOrigin | null>(null);
  const [blocker, setBlocker] = useState<number | null>(null);
  const [isPenalty, setIsPenalty] = useState(false);
  const [phase, setPhase] = useState<AttackPhase>(AttackPhase.POSITIONAL);

  // Clips = proyección de eventos. La selección y los ajustes viven aquí (por id de evento).
  const [clipWindow, setClipWindow] = useState<ClipWindow>(DEFAULT_CLIP_WINDOW);
  const [clipOverrides, setClipOverrides] = useState<Record<number, ClipOverride>>({});
  const [selectedClips, setSelectedClips] = useState<Set<number>>(new Set());
  const [clipFilters, setClipFilters] = useState<Set<ClipFilter>>(new Set());

  const [activeGk, setActiveGk] = useState<Record<Side, number | null>>({ HOME: null, AWAY: null });
  const [tab, setTab] = useState<'tag' | 'clips' | 'stats'>('tag');
  const [editRoster, setEditRoster] = useState(false);
  const [statTeam, setStatTeam] = useState<Side>('HOME');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const persistence = useMatchPersistence(match.matchId, match.events);
  const [serverVideo, setServerVideo] = useState<{ uploading: boolean; ref: string | null }>({ uploading: false, ref: match.videoRef ?? null });
  const [renderJob, setRenderJob] = useState<RenderJobView | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stats = useMemo(() => liveStats(meta, events, home, away), [events, home, away]); // eslint-disable-line react-hooks/exhaustive-deps
  const derivedClips = useMemo(
    () => deriveClips(events, home, away, duration, clipWindow, clipOverrides),
    [events, home, away, duration, clipWindow, clipOverrides],
  );

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed, videoUrl]);

  // Persistir plantilla/alineación cuando cambian (titulares, nombres, porteros). Salta el
  // primer render para no reescribir con lo recién cargado. Best-effort, no bloquea el etiquetado.
  const rosterFirst = useRef(true);
  useEffect(() => {
    if (rosterFirst.current) { rosterFirst.current = false; return; }
    const id = setTimeout(() => { void saveRoster(match.matchId, home, away); }, 800);
    return () => clearTimeout(id);
  }, [home, away, match.matchId]);

  const doFlash = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 1500); };

  const seek = useCallback((t: number) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, duration || t)); setTime(v.currentTime);
  }, [duration]);
  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);
  const onTimeUpdate = () => {
    const v = videoRef.current; if (!v) return;
    setTime(v.currentTime);
    if (clipStopRef.current != null && v.currentTime >= clipStopRef.current) { v.pause(); clipStopRef.current = null; }
  };
  const loadVideo = async (file?: File) => {
    if (!file) return;
    setVideoUrl(URL.createObjectURL(file)); setVideoName(file.name);
    setServerVideo({ uploading: true, ref: null });
    const res = await uploadVideo(meta.matchId!, file);
    setServerVideo({ uploading: false, ref: res.ok ? res.videoRef ?? null : null });
    doFlash(res.ok ? 'Vídeo subido al servidor' : 'No se pudo subir el vídeo');
  };

  const onGkChange = (s: Side, number: number) => {
    if (activeGk[s] === number) return;
    setActiveGk((prev) => ({ ...prev, [s]: number }));
    const e: UiEvent = {
      id: idRef.current++, t: time, period, side: s,
      playerNumber: number, type: EventType.GOALKEEPER_CHANGE, outcome: null, zone: null,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);
    const teamName = s === 'HOME' ? home.name : away.name;
    doFlash(`Portero en pista · #${number} · ${teamName} · ${fmt(time)}`);
  };

  const recordSub = (s: Side, outN: number, inN: number) => {
    const e: UiEvent = {
      id: idRef.current++, t: time, period, side: s,
      playerNumber: inN, type: EventType.SUBSTITUTION, outcome: null, zone: null,
      subOutNumber: outN,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);
    const teamName = s === 'HOME' ? home.name : away.name;
    doFlash(`Cambio · sale #${outN}, entra #${inN} · ${teamName} · ${fmt(time)}`);
  };

  const tag = (a: ActionDef) => {
    const carriesPhase = a.type === EventType.SHOT || a.type === EventType.TURNOVER;
    const e: UiEvent = {
      id: idRef.current++, t: time, period, side,
      playerNumber: a.teamOnly ? null : player,
      type: a.type, outcome: a.outcome ?? null, zone: a.shot ? zone : null,
      origin: a.shot ? origin : null,
      blockerNumber: a.outcome === ShotOutcome.BLOCKED ? blocker : null,
      isPenalty: a.shot && isPenalty ? true : undefined,
      phase: carriesPhase ? phase : undefined,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);
    if (a.shot) { setZone(null); setOrigin(null); setBlocker(null); setIsPenalty(false); }
    doFlash(`${a.label} · ${a.teamOnly ? (side === 'HOME' ? home.name : away.name) : '#' + player} · ${fmt(time)}`);
  };
  const delEvent = (id: number) => {
    const next = events.filter((e) => e.id !== id);
    setEvents(next);
    void persistence.record(next);
    // Limpieza del clip asociado (mismo id): selección y ajuste manual.
    setSelectedClips((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
    setClipOverrides((prev) => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n; });
  };
  // Editar una jugada ya registrada (corregir un click mal tecleado). Recompone todo desde eventos.
  const editEvent = (id: number, patch: Partial<UiEvent>) => {
    const next = events.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEvents(next);
    void persistence.record(next);
  };

  // Pase a 10 m: evento de EQUIPO que se suma al que ataca (`side`). Reutiliza tag() (persistencia,
  // orden, flash, paridad). Shift lo dispara; el −1 corrige la última pulsación de ese equipo.
  const recordNearPass = () => tag(NEAR_PASS_ACTION);
  const undoNearPass = () => {
    const last = [...events].reverse().find((e) => e.type === EventType.NEAR_PASS && e.side === side);
    if (!last) return;
    const next = events.filter((e) => e.id !== last.id);
    setEvents(next);
    void persistence.record(next);
    doFlash(`Pase a 10m −1 · ${side === 'HOME' ? home.name : away.name}`);
  };

  // ── Clips derivados: selección, filtros y ajuste fino ────────────────────────
  const playClip = (c: DerivedClip) => { const v = videoRef.current; if (!v) return; v.currentTime = c.in; clipStopRef.current = c.out; v.play(); };
  const toggleSelectClip = (eventId: number) =>
    setSelectedClips((prev) => { const n = new Set(prev); if (n.has(eventId)) n.delete(eventId); else n.add(eventId); return n; });
  const selectVisibleClips = (ids: number[]) =>
    setSelectedClips((prev) => {
      const n = new Set(prev);
      const allSel = ids.length > 0 && ids.every((id) => n.has(id));
      for (const id of ids) { if (allSel) n.delete(id); else n.add(id); }
      return n;
    });
  const clearClipSelection = () => setSelectedClips(new Set());
  const toggleClipFilter = (f: ClipFilter) =>
    setClipFilters((prev) => { const n = new Set(prev); if (n.has(f)) n.delete(f); else n.add(f); return n; });
  const nudgeClip = (eventId: number, edge: 'in' | 'out', delta: number) => {
    const c = derivedClips.find((x) => x.eventId === eventId); if (!c) return;
    setClipOverrides((prev) => {
      const cur = { ...(prev[eventId] ?? {}) };
      if (edge === 'in') cur.in = Math.max(0, Math.min(c.in + delta, c.out - 1));
      else { const hi = duration > 0 ? duration : Number.POSITIVE_INFINITY; cur.out = Math.max(c.in + 1, Math.min(c.out + delta, hi)); }
      return { ...prev, [eventId]: cur };
    });
  };
  const resetClip = (eventId: number) =>
    setClipOverrides((prev) => { if (!(eventId in prev)) return prev; const n = { ...prev }; delete n[eventId]; return n; });

  const selectedForTimeline: UiClip[] = useMemo(
    () => derivedClips.filter((c) => selectedClips.has(c.eventId)).map((c) => ({ id: c.eventId, in: c.in, out: c.out, label: c.label })),
    [derivedClips, selectedClips],
  );

  const exportMatch = () => {
    const nm = toNormalizedMatch({ ...meta, matchId: meta.matchId!, home, away, events, sourceRef: videoName ?? meta.matchId });
    const blob = new Blob([JSON.stringify(nm, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `normalized-match-${meta.matchId}.json`; a.click();
    doFlash('NormalizedMatch exportado');
  };

  const onSave = async () => {
    const ok = await persistence.flush();
    doFlash(ok ? 'Sincronizado' : 'Sin conexión — a salvo en el dispositivo');
  };
  const onExtract = async () => {
    setBusy('extract');
    const subido = await persistence.flush();
    if (!subido) { setBusy(null); doFlash('Sin conexión: no se puede extraer todavía'); return; }
    const r = await extractStats(meta.matchId!); setBusy(null);
    doFlash(r.ok ? `Estadística extraída · ${r.homeGoals}-${r.awayGoals}` : 'No se pudo extraer');
  };
  const pollRender = useCallback((jobId: string) => {
    const tick = async () => {
      const job = await getRenderJob(jobId);
      if (!job) return;
      setRenderJob(job);
      if (job.status === 'done' || job.status === 'error') {
        doFlash(job.status === 'done' ? 'Clips renderizados' : 'Error al renderizar');
        return;
      }
      pollRef.current = setTimeout(tick, 700);
    };
    void tick();
  }, []);

  const onRender = async () => {
    if (serverVideo.uploading) { doFlash('El vídeo se está subiendo…'); return; }
    if (!serverVideo.ref) { doFlash('Sube el vídeo al servidor primero'); return; }
    const chosen: UiClip[] = derivedClips
      .filter((c) => selectedClips.has(c.eventId))
      .map((c) => ({ id: c.eventId, in: c.in, out: c.out, label: c.label }));
    if (chosen.length === 0) { doFlash('Selecciona algún clip'); return; }
    const res = await startRender(meta.matchId!, chosen, 'accurate');
    if (!res.ok || !res.jobId) { doFlash(res.message || 'No se pudo iniciar el render'); return; }
    setRenderJob({ id: res.jobId, status: 'running', total: res.total ?? chosen.length, completed: 0, clips: [] });
    pollRender(res.jobId);
  };

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const recordNearPassRef = useRef<() => void>(() => {});
  useEffect(() => { recordNearPassRef.current = recordNearPass; });
  const shiftUsedRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (!e.repeat) shiftUsedRef.current = false; return; }
      if (e.code === 'ArrowLeft') { if (e.shiftKey) shiftUsedRef.current = true; seek(time - (e.shiftKey ? 0.1 : 3)); return; }
      if (e.code === 'ArrowRight') { if (e.shiftKey) shiftUsedRef.current = true; seek(time + (e.shiftKey ? 0.1 : 3)); return; }
      if (e.shiftKey) shiftUsedRef.current = true;   // Shift + otra tecla = modificador, no pase
    };
    // Shift como TOQUE limpio (sin flecha) = +1 pase a 10 m; así no choca con Shift+flecha (frame).
    const onKeyUp = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!shiftUsedRef.current) recordNearPassRef.current();
        shiftUsedRef.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }, [time, togglePlay, seek]);

  return (
    <div style={{ background: C.bg, color: C.text, height: '100vh' }} className="flex flex-col">
      <Scoreboard
        competition={meta.competition} matchday={meta.matchday}
        homeName={home.name} awayName={away.name}
        homeGoals={stats.summary.home.goals} awayGoals={stats.summary.away.goals}
        time={time} period={period} videoName={videoName} onLoadVideo={loadVideo}
        onExport={exportMatch} onSave={onSave} onExtract={onExtract} busy={busy}
        syncState={persistence.state} syncError={persistence.lastError} lastSyncedAt={persistence.lastSyncedAt}
      />

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="flex-1 min-h-0 flex flex-col">
          <VideoStage
            videoRef={videoRef} videoUrl={videoUrl} onLoadVideo={loadVideo}
            onLoadedMetadata={setDuration} onTimeUpdate={onTimeUpdate}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            togglePlay={togglePlay} seek={seek} time={time} duration={duration} playing={playing}
            speed={speed} setSpeed={setSpeed} events={events} clips={selectedForTimeline} flash={flash}
          />
          <div className="px-3 pb-3">
            <NearPassBar side={side} homeName={home.name} awayName={away.name}
              homeCount={stats.summary.home.nearPasses} awayCount={stats.summary.away.nearPasses}
              onAdd={recordNearPass} onUndo={undoNearPass} />
          </div>
        </div>

        <div className="lg:w-[30rem] flex flex-col min-h-0" style={{ borderLeft: `1px solid ${C.line}`, background: C.panel }}>
          <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
            {([['tag', 'Etiquetar', ListOrdered], ['clips', 'Clips', Scissors], ['stats', 'Estadística', BarChart3]] as const).map(([k, l, Ic]) => (
              <button key={k} onClick={() => setTab(k)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm"
                style={{ color: tab === k ? C.text : C.muted, fontWeight: tab === k ? 600 : 500, borderBottom: `2px solid ${tab === k ? C.amber : 'transparent'}`, background: tab === k ? C.panel2 : 'transparent' }}>
                <Ic size={15} /> {l}{k === 'clips' && selectedClips.size > 0 ? ` (${selectedClips.size})` : ''}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'tag' && (
              <TagPanel side={side} setSide={setSide} player={player} setPlayer={setPlayer} period={period} setPeriod={setPeriod}
                zone={zone} setZone={setZone} origin={origin} setOrigin={setOrigin} blocker={blocker} setBlocker={setBlocker} isPenalty={isPenalty} setIsPenalty={setIsPenalty}
                phase={phase} setPhase={setPhase}
                home={home} away={away} setHome={setHome} setAway={setAway}
                editRoster={editRoster} setEditRoster={setEditRoster} tag={tag} time={time}
                activeGk={activeGk[side]} onGkChange={onGkChange} events={events} recordSub={recordSub}
                matchId={match.matchId} season={match.season} onLinkedToCatalog={(h, a) => { setHome(h); setAway(a); }} />)}
            {tab === 'clips' && (
              <ClipsPanel
                clips={derivedClips} selected={selectedClips}
                toggleSelect={toggleSelectClip} selectVisible={selectVisibleClips} clearSelection={clearClipSelection}
                filters={clipFilters} toggleFilter={toggleClipFilter}
                window={clipWindow} setWindow={setClipWindow}
                nudgeClip={nudgeClip} resetClip={resetClip}
                playClip={playClip} onRender={onRender}
                renderJob={renderJob} videoUploading={serverVideo.uploading} videoReady={!!serverVideo.ref} />
            )}
            {tab === 'stats' && (
              <StatsPanel stats={stats} statTeam={statTeam} setStatTeam={setStatTeam} expanded={expanded} setExpanded={setExpanded} events={events} />
            )}
          </div>
        </div>
      </div>

      <EventLog events={events} home={home} away={away} seek={seek} delEvent={delEvent} editEvent={editEvent} />
    </div>
  );
}
