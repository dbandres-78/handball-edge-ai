'use client';
import { Play, Trash2, Film, Download, Loader2 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { UiClip } from '@/lib/handball/mapping';
import type { RenderJobView } from './actions';

interface Props {
  clips: UiClip[]; inPt: number | null; outPt: number | null; time: number;
  markIn: () => void; markOut: () => void; addClip: () => void;
  playClip: (c: UiClip) => void; delClip: (id: number) => void;
  onRender: () => void;
  renderJob: RenderJobView | null;
  videoUploading: boolean; videoReady: boolean;
}

export function ClipsPanel(p: Props) {
  const running = p.renderJob?.status === 'running' || p.renderJob?.status === 'queued';
  const done = p.renderJob?.status === 'done';
  const renderLabel = p.videoUploading ? 'Subiendo vídeo…'
    : !p.videoReady ? 'Sube el vídeo para renderizar'
    : running ? `Renderizando ${p.renderJob!.completed}/${p.renderJob!.total}…`
    : 'Renderizar clips (.mp4)';

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="p-3 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>CORTE ACTUAL</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>{fmt(p.time)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={p.markIn} className="flex-1 py-1.5 rounded-md text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: p.inPt != null ? C.amber : C.muted, fontFamily: MONO }}>IN {p.inPt != null ? fmt(p.inPt) : '—'}</button>
          <button onClick={p.markOut} className="flex-1 py-1.5 rounded-md text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: p.outPt != null ? C.amber : C.muted, fontFamily: MONO }}>OUT {p.outPt != null ? fmt(p.outPt) : '—'}</button>
          <button onClick={p.addClip} className="px-3 py-1.5 rounded-md text-sm" style={{ background: C.amber, color: '#0E1420', fontWeight: 600 }}>Cortar</button>
        </div>
      </div>

      {p.clips.length === 0 ? (
        <div className="text-center py-8" style={{ color: C.faint, fontSize: 13 }}>
          Aún no hay clips. Marca <span style={{ fontFamily: MONO }}>IN</span> / <span style={{ fontFamily: MONO }}>OUT</span> sobre una jugada y córtala.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {p.clips.map((c) => {
              const rc = p.renderJob?.clips.find((x) => Math.abs(x.in - c.in) < 0.01 && Math.abs(x.out - c.out) < 0.01);
              return (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                  <button onClick={() => p.playClip(c)} className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.amber }}><Play size={14} /></button>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 13, color: C.text }}>{c.label}</div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{fmt(c.in)} → {fmt(c.out)} · {fmt(c.out - c.in)}</div>
                  </div>
                  {rc?.status === 'done' && rc.downloadUrl && (
                    <a href={rc.downloadUrl} download className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.goal }} title="Descargar .mp4"><Download size={14} /></a>
                  )}
                  {rc?.status === 'pending' && running && <Loader2 size={14} color={C.muted} className="flex-shrink-0 animate-spin" />}
                  {rc?.status === 'error' && <span title={rc.error} style={{ color: C.neg, fontSize: 11 }}>error</span>}
                  <button onClick={() => p.delClip(c.id)} className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ color: C.faint }}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>

          {running && (
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.panel3 }}>
              <div style={{ width: `${p.renderJob!.total ? (p.renderJob!.completed / p.renderJob!.total) * 100 : 0}%`, background: C.amber, height: '100%', transition: 'width .3s' }} />
            </div>
          )}

          <button onClick={p.onRender} disabled={running || p.videoUploading || !p.videoReady}
            className="flex items-center justify-center gap-1.5 py-2 rounded-md text-sm"
            style={{ background: done ? C.panel : C.panel3, border: `1px solid ${C.line}`, color: C.text, fontWeight: 600, opacity: running || p.videoUploading || !p.videoReady ? 0.6 : 1 }}>
            {running ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} {renderLabel}
          </button>
        </>
      )}
      <div className="text-xs px-1" style={{ color: C.faint }}>
        El vídeo se sube al servidor al cargarlo. «Renderizar» ejecuta ffmpeg por clip (corte frame-exacto) y habilita la descarga de cada .mp4.
      </div>
    </div>
  );
}
