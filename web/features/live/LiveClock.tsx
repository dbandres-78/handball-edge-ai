'use client';
import { Play, Pause, Minus, Plus, RotateCcw } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';

interface Props {
  seconds: number;
  running: boolean;
  onToggle: () => void;
  onAdjust: (delta: number) => void;
  onResetPeriod: () => void;
  period: number;
  setPeriod: (p: number) => void;
  periodMinutes: number;
  homeName: string; awayName: string;
  homeGoals: number; awayGoals: number;
}

/**
 * Pieza central del modo directo: el reloj manda. Grande y legible desde lejos porque el
 * anotador está mirando la pista, no la pantalla.
 */
export function LiveClock(p: Props) {
  const limit = p.periodMinutes * 60 * p.period;
  const overtime = p.seconds > limit;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      {/* Marcador */}
      <div className="flex items-center justify-center gap-6 w-full" style={{ maxWidth: 720 }}>
        <TeamScore name={p.homeName} goals={p.homeGoals} color={C.home} align="right" />
        <span style={{ fontFamily: MONO, fontSize: 40, color: C.faint }}>:</span>
        <TeamScore name={p.awayName} goals={p.awayGoals} color={C.away} align="left" />
      </div>

      {/* Reloj */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="px-8 py-3 rounded-xl"
          style={{
            background: C.bg,
            border: `2px solid ${overtime ? C.neg : running(p) ? C.amber : C.line}`,
            boxShadow: running(p) ? `0 0 24px ${C.amber}22` : 'none',
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 68, fontWeight: 700, letterSpacing: 3, color: overtime ? C.neg : C.amber, lineHeight: 1 }}>
            {fmt(p.seconds)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={p.onToggle}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg"
            style={{ background: p.running ? C.panel3 : C.amber, color: p.running ? C.text : '#0E1420', fontWeight: 700, border: `1px solid ${C.line}` }}>
            {p.running ? <><Pause size={16} /> Parar reloj</> : <><Play size={16} /> {p.seconds > 0 ? 'Reanudar' : 'Iniciar partido'}</>}
          </button>
          <Small onClick={() => p.onAdjust(-10)} title="−10 s"><Minus size={13} />10s</Small>
          <Small onClick={() => p.onAdjust(10)} title="+10 s"><Plus size={13} />10s</Small>
          <Small onClick={p.onResetPeriod} title={`Ir al inicio de la parte ${p.period}`}><RotateCcw size={13} /></Small>
        </div>

        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11, color: C.faint, marginRight: 2 }}>PARTE</span>
          {[1, 2, 3, 4].map((n) => (
            <button key={n} onClick={() => p.setPeriod(n)} className="w-8 h-8 rounded-md"
              style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700,
                background: p.period === n ? C.panel3 : C.panel,
                color: p.period === n ? C.text : C.muted, border: `1px solid ${C.line}` }}>
              {n}
            </button>
          ))}
          <span style={{ fontSize: 11, color: C.faint, marginLeft: 6 }}>
            {p.periodMinutes}′ por parte
            {overtime && <span style={{ color: C.neg, marginLeft: 6 }}>· tiempo cumplido</span>}
          </span>
        </div>
      </div>

      <p className="text-center" style={{ fontSize: 12, color: C.faint, maxWidth: 460 }}>
        El reloj corre solo. Párralo únicamente en tiempos muertos o interrupciones del árbitro.
        Las acciones se sellan con el tiempo exacto en el que las marcas.
      </p>
    </div>
  );
}

const running = (p: Props) => p.running;

function TeamScore({ name, goals, color, align }: { name: string; goals: number; color: string; align: 'left' | 'right' }) {
  return (
    <div className="flex-1 min-w-0" style={{ textAlign: align }}>
      <div className="truncate" style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{name}</div>
      <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 700, color, lineHeight: 1.1 }}>
        {String(goals).padStart(2, '0')}
      </div>
    </div>
  );
}

function Small({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-0.5 px-2.5 h-9 rounded-lg"
      style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted, fontFamily: MONO, fontSize: 12 }}>
      {children}
    </button>
  );
}
