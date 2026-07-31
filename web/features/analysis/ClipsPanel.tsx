'use client';
import { Play, Film, Download, Loader2, CheckSquare, Square, RotateCcw, Minus, Plus } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { DerivedClip, ClipFilter, ClipWindow, matchesFilters } from '@/lib/handball/clips';
import { ShotOrigin } from '@/lib/handball/mapping';
import { ORIGIN_SHORT } from './ShotOriginCourt';
import type { RenderJobView } from './actions';

interface Props {
  clips: DerivedClip[];
  selected: Set<number>;
  toggleSelect: (eventId: number) => void;
  selectVisible: (ids: number[]) => void;
  clearSelection: () => void;
  filters: Set<ClipFilter>;
  toggleFilter: (f: ClipFilter) => void;
  window: ClipWindow;
  setWindow: (w: ClipWindow) => void;
  nudgeClip: (eventId: number, edge: 'in' | 'out', delta: number) => void;
  resetClip: (eventId: number) => void;
  playClip: (c: DerivedClip) => void;
  onRender: () => void;
  renderJob: RenderJobView | null;
  videoUploading: boolean; videoReady: boolean;
}

const TEAM_FILTERS: { key: ClipFilter; label: string; color: string }[] = [
  { key: 'HOME', label: 'Local', color: C.home },
  { key: 'AWAY', label: 'Visitante', color: C.away },
];
const ACTION_FILTERS: { key: ClipFilter; label: string; color: string }[] = [
  { key: 'GOAL', label: 'Gol', color: C.goal },
  { key: 'SAVED', label: 'Parada', color: C.save },
  { key: 'MISSED', label: 'Fuera', color: C.miss },
  { key: 'BLOCKED', label: 'Blocado', color: C.miss },
  { key: 'TURNOVER', label: 'Pérdida', color: C.neg },
  { key: 'STEAL', label: 'Recuperación', color: C.pos },
  { key: 'FOUL', label: 'Falta', color: C.neutral },
  { key: 'TWO_MINUTES', label: 'Excl. 2′', color: C.warn },
  { key: 'YELLOW', label: 'Amarilla', color: C.warn },
  { key: 'RED', label: 'Roja', color: C.neg },
];
// Zonas de tiro en orden de pantalla (izquierda→derecha), con su etiqueta corta.
const ZONE_ORDER: ShotOrigin[] = [
  ShotOrigin.WING_RIGHT, ShotOrigin.NINE_RIGHT, ShotOrigin.SIX_RIGHT,
  ShotOrigin.NINE_CENTER, ShotOrigin.SIX_CENTER,
  ShotOrigin.SIX_LEFT, ShotOrigin.NINE_LEFT, ShotOrigin.WING_LEFT,
];
const ZONE_FILTERS: { key: ClipFilter; label: string }[] = ZONE_ORDER.map((o) => ({ key: `Z:${o}` as ClipFilter, label: ORIGIN_SHORT[o] }));

export function ClipsPanel(p: Props) {
  const running = p.renderJob?.status === 'running' || p.renderJob?.status === 'queued';
  const visible = p.clips.filter((c) => matchesFilters(c, p.filters));
  const visibleIds = visible.map((c) => c.eventId);
  const selCount = p.selected.size;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => p.selected.has(id));

  const renderLabel = p.videoUploading ? 'Subiendo vídeo…'
    : !p.videoReady ? 'Sube el vídeo para renderizar'
    : running ? `Renderizando ${p.renderJob!.completed}/${p.renderJob!.total}…`
    : `Renderizar seleccionados (${selCount})`;

  const setRoll = (edge: 'preRoll' | 'postRoll', delta: number) =>
    p.setWindow({ ...p.window, [edge]: Math.max(0, p.window[edge] + delta) });

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Resumen + ventana global */}
      <div className="p-3 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>CLIPS AUTOMÁTICOS</span>
          <span style={{ fontSize: 12, color: C.muted }}>{p.clips.length} detectados · {selCount} sel.</span>
        </div>
        <div className="flex items-center gap-3">
          <RollStepper label="Antes" value={p.window.preRoll} onDelta={(d) => setRoll('preRoll', d)} />
          <RollStepper label="Después" value={p.window.postRoll} onDelta={(d) => setRoll('postRoll', d)} />
        </div>
      </div>

      {/* Filtros: equipo · acción · zona (OR dentro de cada grupo, AND entre grupos) */}
      <div className="flex flex-col gap-2">
        <FilterGroup label="Equipo" filters={TEAM_FILTERS} active={p.filters} onToggle={p.toggleFilter} />
        <FilterGroup label="Acción" filters={ACTION_FILTERS} active={p.filters} onToggle={p.toggleFilter} />
        <FilterGroup label="Zona de tiro" filters={ZONE_FILTERS} active={p.filters} onToggle={p.toggleFilter} mono />
      </div>

      {/* Acciones de selección */}
      <div className="flex items-center gap-2">
        <button onClick={() => p.selectVisible(visibleIds)} disabled={visible.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm"
          style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, opacity: visible.length === 0 ? 0.5 : 1 }}>
          {allVisibleSelected ? <CheckSquare size={14} color={C.amber} /> : <Square size={14} />} Seleccionar visibles
        </button>
        <button onClick={p.clearSelection} disabled={selCount === 0}
          className="px-3 py-1.5 rounded-md text-sm"
          style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.muted, opacity: selCount === 0 ? 0.5 : 1 }}>
          Quitar
        </button>
      </div>

      {/* Lista */}
      {p.clips.length === 0 ? (
        <div className="text-center py-8" style={{ color: C.faint, fontSize: 13 }}>
          Aún no hay clips. Cada acción que anotes (gol, pérdida, parada…) genera uno aquí.
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-6" style={{ color: C.faint, fontSize: 13 }}>
          Ningún clip pasa los filtros activos.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((c) => {
            const sel = p.selected.has(c.eventId);
            const rc = p.renderJob?.clips.find((x) => Math.abs(x.in - c.in) < 0.05 && Math.abs(x.out - c.out) < 0.05);
            const accent = c.side === 'HOME' ? C.home : C.away;
            return (
              <div key={c.eventId} className="rounded-md" style={{ background: C.panel2, border: `1px solid ${sel ? C.amber : C.line}` }}>
                <div className="flex items-center gap-2 p-2">
                  <button onClick={() => p.toggleSelect(c.eventId)} className="flex-shrink-0" title={sel ? 'Quitar de la selección' : 'Seleccionar'} style={{ color: sel ? C.amber : C.faint }}>
                    {sel ? <CheckSquare size={17} /> : <Square size={17} />}
                  </button>
                  <button onClick={() => p.playClip(c)} className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.amber }}><Play size={14} /></button>
                  <div className="flex-1 min-w-0">
                    <div className="truncate flex items-center gap-1.5" style={{ fontSize: 13, color: C.text }}>
                      <span style={{ width: 6, height: 6, borderRadius: 6, background: accent, flexShrink: 0 }} />
                      {c.label}{c.edited && <span title="Ajustado a mano" style={{ fontSize: 10, color: C.faint }}>·editado</span>}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{fmt(c.in)} → {fmt(c.out)} · {fmt(c.out - c.in)}</div>
                  </div>
                  {rc?.status === 'done' && rc.downloadUrl && (
                    <a href={rc.downloadUrl} download className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.goal }} title="Descargar .mp4"><Download size={14} /></a>
                  )}
                  {rc?.status === 'pending' && running && <Loader2 size={14} color={C.muted} className="flex-shrink-0 animate-spin" />}
                  {rc?.status === 'error' && <span title={rc.error} style={{ color: C.neg, fontSize: 11 }}>error</span>}
                </div>
                {/* Ajuste fino sólo en los seleccionados, para no saturar */}
                {sel && (
                  <div className="flex items-center gap-2 px-2 pb-2" style={{ fontSize: 11, color: C.muted }}>
                    <Edge label="IN" onMinus={() => p.nudgeClip(c.eventId, 'in', -1)} onPlus={() => p.nudgeClip(c.eventId, 'in', 1)} />
                    <Edge label="OUT" onMinus={() => p.nudgeClip(c.eventId, 'out', -1)} onPlus={() => p.nudgeClip(c.eventId, 'out', 1)} />
                    {c.edited && (
                      <button onClick={() => p.resetClip(c.eventId)} className="flex items-center gap-1 ml-auto" style={{ color: C.faint }} title="Volver a la ventana automática">
                        <RotateCcw size={12} /> reset
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {running && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.panel3 }}>
          <div style={{ width: `${p.renderJob!.total ? (p.renderJob!.completed / p.renderJob!.total) * 100 : 0}%`, background: C.amber, height: '100%', transition: 'width .3s' }} />
        </div>
      )}

      {p.clips.length > 0 && (
        <button onClick={p.onRender} disabled={running || p.videoUploading || !p.videoReady || selCount === 0}
          className="flex items-center justify-center gap-1.5 py-2 rounded-md text-sm"
          style={{ background: C.panel3, border: `1px solid ${C.line}`, color: C.text, fontWeight: 600, opacity: running || p.videoUploading || !p.videoReady || selCount === 0 ? 0.6 : 1 }}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} {renderLabel}
        </button>
      )}

      <div className="text-xs px-1" style={{ color: C.faint }}>
        Los clips se crean solos al anotar. Marca los que quieras, ajústalos si hace falta y renderiza sólo esos (ffmpeg, corte frame-exacto).
      </div>
    </div>
  );
}

function RollStepper({ label, value, onDelta }: { label: string; value: number; onDelta: (d: number) => void }) {
  return (
    <div className="flex-1">
      <div style={{ fontSize: 10, color: C.faint, marginBottom: 3 }}>{label}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onDelta(-1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted }}><Minus size={12} /></button>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.text, minWidth: 34, textAlign: 'center' }}>{value}s</span>
        <button onClick={() => onDelta(1)} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted }}><Plus size={12} /></button>
      </div>
    </div>
  );
}

function Edge({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, width: 26 }}>{label}</span>
      <button onClick={onMinus} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted }}><Minus size={12} /></button>
      <button onClick={onPlus} className="w-6 h-6 rounded flex items-center justify-center" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.muted }}><Plus size={12} /></button>
    </div>
  );
}

function FilterGroup({ label, filters, active, onToggle, mono }: {
  label: string;
  filters: { key: ClipFilter; label: string; color?: string }[];
  active: Set<ClipFilter>; onToggle: (f: ClipFilter) => void; mono?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: 1, color: C.faint, marginBottom: 3 }}>{label.toUpperCase()}</div>
      <div className="flex flex-wrap gap-1">
        {filters.map((f) => {
          const on = active.has(f.key);
          const col = f.color ?? C.amber;
          return (
            <button key={f.key} onClick={() => onToggle(f.key)} className="px-2 py-0.5 rounded-full text-xs"
              style={{ background: on ? `${col}22` : C.panel2, border: `1px solid ${on ? col : C.line}`, color: on ? col : C.muted, fontWeight: on ? 600 : 500, fontFamily: mono ? MONO : undefined, minWidth: mono ? 34 : undefined, textAlign: 'center' }}>
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
