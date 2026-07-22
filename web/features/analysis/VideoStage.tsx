'use client';
import { useRef, RefObject } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Scissors, Upload,
} from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { EventType, ShotOutcome, UiEvent, UiClip } from '@/lib/handball/mapping';

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  videoUrl: string | null;
  onLoadVideo: (f?: File) => void;
  onLoadedMetadata: (d: number) => void;
  onTimeUpdate: () => void;
  onPlay: () => void; onPause: () => void;
  togglePlay: () => void; seek: (t: number) => void;
  time: number; duration: number; playing: boolean;
  speed: number; setSpeed: (s: number) => void;
  events: UiEvent[]; clips: UiClip[];
  inPt: number | null; outPt: number | null;
  markIn: () => void; markOut: () => void; addClip: () => void;
  flash: string | null;
}

export function VideoStage(p: Props) {
  return (
    <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
      <div className="relative rounded-lg overflow-hidden flex-1 flex items-center justify-center" style={{ background: '#05080E', border: `1px solid ${C.line}`, minHeight: 240 }}>
        {p.videoUrl ? (
          <video
            ref={p.videoRef} src={p.videoUrl} className="max-h-full max-w-full"
            onTimeUpdate={p.onTimeUpdate} onLoadedMetadata={(e) => p.onLoadedMetadata(e.currentTarget.duration)}
            onPlay={p.onPlay} onPause={p.onPause} onClick={p.togglePlay} style={{ cursor: 'pointer' }}
          />
        ) : (
          <label className="flex flex-col items-center gap-3 cursor-pointer px-8 py-10 rounded-lg" style={{ border: `1px dashed ${C.line}` }}>
            <Upload size={28} color={C.muted} />
            <div style={{ color: C.text, fontWeight: 600 }}>Cargar partido</div>
            <div style={{ color: C.faint, fontSize: 13 }}>Selecciona el vídeo del equipo a analizar</div>
            <input type="file" accept="video/*" className="hidden" onChange={(e) => p.onLoadVideo(e.target.files?.[0])} />
          </label>
        )}
        {p.flash && (
          <div className="absolute left-3 bottom-3 px-3 py-1.5 rounded-md text-sm" style={{ background: 'rgba(14,20,32,.92)', border: `1px solid ${C.line}`, fontFamily: MONO }}>
            {p.flash}
          </div>
        )}
      </div>

      <Timeline time={p.time} duration={p.duration} events={p.events} clips={p.clips} inPt={p.inPt} outPt={p.outPt} seek={p.seek} />
      <Transport {...p} />
    </div>
  );
}

function Timeline({ time, duration, events, clips, inPt, outPt, seek }: Pick<Props, 'time' | 'duration' | 'events' | 'clips' | 'inPt' | 'outPt' | 'seek'>) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const onClick = (e: React.MouseEvent) => {
    const r = barRef.current!.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * duration);
  };
  return (
    <div className="select-none">
      <div ref={barRef} onClick={onClick} className="relative h-10 rounded-md cursor-pointer" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {inPt != null && outPt != null && outPt > inPt && (
          <div className="absolute top-0 bottom-0" style={{ left: `${pct(inPt)}%`, width: `${pct(outPt - inPt)}%`, background: `${C.amber}22`, borderLeft: `2px solid ${C.amber}`, borderRight: `2px solid ${C.amber}` }} />
        )}
        {clips.map((c) => (
          <div key={c.id} className="absolute bottom-0 h-1.5" title={c.label} style={{ left: `${pct(c.in)}%`, width: `${pct(c.out - c.in)}%`, background: C.amber, opacity: 0.6, borderRadius: 2 }} />
        ))}
        {events.map((ev) => {
          const isGoal = ev.type === EventType.SHOT && ev.outcome === ShotOutcome.GOAL;
          const col = isGoal ? (ev.side === 'HOME' ? C.home : C.away)
            : ev.type === EventType.RED_CARD || ev.type === EventType.TURNOVER ? C.neg
            : ev.type === EventType.YELLOW_CARD || ev.type === EventType.TWO_MINUTES ? C.warn : C.faint;
          return (
            <div key={ev.id} onClick={(e) => { e.stopPropagation(); seek(ev.t); }} className="absolute top-1.5" title={fmt(ev.t)}
              style={{ left: `calc(${pct(ev.t)}% - 3px)`, width: isGoal ? 6 : 4, height: isGoal ? 20 : 14, background: col, borderRadius: 2, cursor: 'pointer', opacity: isGoal ? 1 : 0.8 }} />
          );
        })}
        <div className="absolute top-0 bottom-0" style={{ left: `calc(${pct(time)}% - 1px)`, width: 2, background: C.text }} />
        <div className="absolute" style={{ left: `calc(${pct(time)}% - 5px)`, top: -4, width: 10, height: 10, borderRadius: 10, background: C.text }} />
      </div>
    </div>
  );
}

function Transport(p: Props) {
  const Btn = ({ onClick, children, title, active }: { onClick: () => void; children: React.ReactNode; title: string; active?: boolean }) => (
    <button onClick={onClick} title={title} className="flex items-center justify-center rounded-md h-8 px-2" style={{ background: active ? C.amber : C.panel, color: active ? '#0E1420' : C.text, border: `1px solid ${C.line}` }}>
      {children}
    </button>
  );
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Btn onClick={() => p.seek(p.time - 1)} title="−1s"><Rewind size={15} /></Btn>
      <Btn onClick={() => p.seek(p.time - 0.1)} title="−1 frame (⇧←)"><SkipBack size={15} /></Btn>
      <Btn onClick={p.togglePlay} title="Play/Pausa (espacio)">{p.playing ? <Pause size={16} /> : <Play size={16} />}</Btn>
      <Btn onClick={() => p.seek(p.time + 0.1)} title="+1 frame (⇧→)"><SkipForward size={15} /></Btn>
      <Btn onClick={() => p.seek(p.time + 1)} title="+1s"><FastForward size={15} /></Btn>

      <div className="flex items-center gap-0.5 ml-1">
        {[0.25, 0.5, 1, 1.5, 2].map((s) => (
          <button key={s} onClick={() => p.setSpeed(s)} className="px-1.5 h-8 rounded-md text-xs" style={{ fontFamily: MONO, background: p.speed === s ? C.panel3 : 'transparent', color: p.speed === s ? C.text : C.muted, border: `1px solid ${p.speed === s ? C.line : 'transparent'}` }}>
            {s}×
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Btn onClick={p.markIn} title="Marcar entrada (i)" active={p.inPt != null}>
          <span style={{ fontFamily: MONO, fontSize: 12 }}>IN {p.inPt != null ? fmt(p.inPt) : '—'}</span>
        </Btn>
        <Btn onClick={p.markOut} title="Marcar salida (o)" active={p.outPt != null}>
          <span style={{ fontFamily: MONO, fontSize: 12 }}>OUT {p.outPt != null ? fmt(p.outPt) : '—'}</span>
        </Btn>
        <button onClick={p.addClip} className="flex items-center gap-1 h-8 px-2.5 rounded-md text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.amber, fontWeight: 600 }}>
          <Scissors size={14} /> Cortar
        </button>
      </div>
    </div>
  );
}
