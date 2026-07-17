'use client';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { ListOrdered, Scissors, BarChart3 } from 'lucide-react';
import { PALETTE as C } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { ActionDef } from '@/lib/handball/actions';
import {
  EventType, ShotOrigin, ShotOutcome, UiEvent, UiClip, UiTeam, Side, liveStats,
} from '@/lib/handball/mapping';
import type { LoadedMatch } from '@/features/matches/types';
import { Scoreboard } from './Scoreboard';
import { VideoStage } from './VideoStage';
import { TagPanel } from './TagPanel';
import { ClipsPanel } from './ClipsPanel';
import { StatsPanel } from './StatsPanel';
import { EventLog } from './EventLog';
import { extractStats, uploadVideo, startRender, getRenderJob, RenderJobView } from './actions';
import { toNormalizedMatch } from '@/features/matches/to-normalized';
import { useMatchPersistence } from '@/features/live/useMatchPersistence';

export function AnalysisRoom({ match }: { match: LoadedMatch }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const idRef = useRef(Math.max(0, ...match.events.map((e) => e.id)) + 1);
  const clipStopRef = useRef<number | null>(null);

  const meta = { matchId: match.matchId, competition: match.competition, matchday: match.matchday, playedAt: match.playedAt };
  const [home, setHome] = useState<UiTeam>(match.home);
  const [away, setAway] = useState<UiTeam>(match.away);
  const [events, setEvents] = useState<UiEvent[]>(match.events);
  const [clips, setClips] = useState<UiClip[]>([]);

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
  const [inPt, setInPt] = useState<number | null>(null);
  const [outPt, setOutPt] = useState<number | null>(null);

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

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed, videoUrl]);

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

  const tag = (a: ActionDef) => {
    const e: UiEvent = {
      id: idRef.current++, t: time, period, side,
      playerNumber: a.teamOnly ? null : player,
      type: a.type, outcome: a.outcome ?? null, zone: a.shot ? zone : null,
      origin: a.shot ? origin : null,
      blockerNumber: a.outcome === ShotOutcome.BLOCKED ? blocker : null,
    };
    const next = [...events, e].sort((x, y) => x.t - y.t);
    setEvents(next);
    void persistence.record(next);
    if (a.shot) { setZone(null); setOrigin(null); setBlocker(null); }
    doFlash(`${a.label} · ${a.teamOnly ? (side === 'HOME' ? home.name : away.name) : '#' + player} · ${fmt(time)}`);
  };
  const delEvent = (id: number) => {
    const next = events.filter((e) => e.id !== id);
    setEvents(next);
    void persistence.record(next);
  };

  const markIn = () => setInPt(time);
  const markOut = () => setOutPt(time);
  const addClip = () => {
    if (inPt == null || outPt == null || outPt <= inPt) { doFlash('Marca entrada y salida válidas'); return; }
    const near = [...events].reverse().find((e) => e.t >= inPt && e.t <= outPt);
    const label = near ? `#${near.playerNumber ?? '—'} · ${near.type}` : `Clip ${clips.length + 1}`;
    setClips((c) => [...c, { id: idRef.current++, in: inPt, out: outPt, label }]);
    setInPt(null); setOutPt(null);
  };
  const playClip = (c: UiClip) => { const v = videoRef.current; if (!v) return; v.currentTime = c.in; clipStopRef.current = c.out; v.play(); };
  const delClip = (id: number) => setClips((c) => c.filter((x) => x.id !== id));

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
    if (clips.length === 0) { doFlash('No hay clips que renderizar'); return; }
    const res = await startRender(meta.matchId!, clips, 'accurate');
    if (!res.ok || !res.jobId) { doFlash(res.message || 'No se pudo iniciar el render'); return; }
    setRenderJob({ id: res.jobId, status: 'running', total: res.total ?? clips.length, completed: 0, clips: [] });
    pollRender(res.jobId);
  };

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowLeft') seek(time - (e.shiftKey ? 0.1 : 3));
      else if (e.code === 'ArrowRight') seek(time + (e.shiftKey ? 0.1 : 3));
      else if (e.key === 'i') markIn();
      else if (e.key === 'o') markOut();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        <VideoStage
          videoRef={videoRef} videoUrl={videoUrl} onLoadVideo={loadVideo}
          onLoadedMetadata={setDuration} onTimeUpdate={onTimeUpdate}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          togglePlay={togglePlay} seek={seek} time={time} duration={duration} playing={playing}
          speed={speed} setSpeed={setSpeed} events={events} clips={clips}
          inPt={inPt} outPt={outPt} markIn={markIn} markOut={markOut} addClip={addClip} flash={flash}
        />

        <div className="lg:w-96 flex flex-col min-h-0" style={{ borderLeft: `1px solid ${C.line}`, background: C.panel }}>
          <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
            {([['tag', 'Etiquetar', ListOrdered], ['clips', 'Clips', Scissors], ['stats', 'Estadística', BarChart3]] as const).map(([k, l, Ic]) => (
              <button key={k} onClick={() => setTab(k)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm"
                style={{ color: tab === k ? C.text : C.muted, fontWeight: tab === k ? 600 : 500, borderBottom: `2px solid ${tab === k ? C.amber : 'transparent'}`, background: tab === k ? C.panel2 : 'transparent' }}>
                <Ic size={15} /> {l}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'tag' && (
              <TagPanel side={side} setSide={setSide} player={player} setPlayer={setPlayer} period={period} setPeriod={setPeriod}
                zone={zone} setZone={setZone} origin={origin} setOrigin={setOrigin} blocker={blocker} setBlocker={setBlocker}
                home={home} away={away} setHome={setHome} setAway={setAway}
                editRoster={editRoster} setEditRoster={setEditRoster} tag={tag} time={time} />
            )}
            {tab === 'clips' && (
              <ClipsPanel clips={clips} inPt={inPt} outPt={outPt} time={time} markIn={markIn} markOut={markOut}
                addClip={addClip} playClip={playClip} delClip={delClip} onRender={onRender}
                renderJob={renderJob} videoUploading={serverVideo.uploading} videoReady={!!serverVideo.ref} />
            )}
            {tab === 'stats' && (
              <StatsPanel stats={stats} statTeam={statTeam} setStatTeam={setStatTeam} expanded={expanded} setExpanded={setExpanded} events={events} />
            )}
          </div>
        </div>
      </div>

      <EventLog events={events} home={home} away={away} seek={seek} delEvent={delEvent} />
    </div>
  );
}
