'use client';
import { Clock, Film, Download, Save, BarChart3 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import { fmt } from '@/lib/handball/format';
import { SyncBadge } from '@/features/live/SyncBadge';
import type { SyncState } from '@/features/live/useMatchPersistence';

interface Props {
  competition?: string; matchday?: number;
  homeName: string; awayName: string; homeGoals: number; awayGoals: number;
  time: number; period: number;
  videoName: string | null; onLoadVideo: (f?: File) => void;
  onExport: () => void; onSave: () => void; onExtract: () => void; busy?: string | null;
  syncState: SyncState; syncError?: string | null; lastSyncedAt?: number | null;
}

export function Scoreboard(p: Props) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap" style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: C.faint }}>HANDBALL EDGE AI</span>
        <span style={{ color: C.line }}>/</span>
        <span style={{ fontSize: 12, color: C.muted }}>{p.competition} · J{p.matchday}</span>
      </div>

      <div className="flex items-center gap-3 mx-auto">
        <TeamName color={C.home} name={p.homeName} align="right" />
        <div className="flex items-center gap-2 px-3 py-1 rounded-md" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
          <Digit color={C.home} v={p.homeGoals} />
          <span style={{ color: C.faint, fontFamily: MONO }}>:</span>
          <Digit color={C.away} v={p.awayGoals} />
        </div>
        <TeamName color={C.away} name={p.awayName} align="left" />
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
        <Clock size={13} color={C.amber} />
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: C.amber, letterSpacing: 1 }}>{fmt(p.time)}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>P{p.period}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <SyncBadge state={p.syncState} error={p.syncError} lastSyncedAt={p.lastSyncedAt} />
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted }}>
          <Film size={14} /> <span className="truncate" style={{ maxWidth: 110 }}>{p.videoName ?? 'Vídeo'}</span>
          <input type="file" accept="video/*" className="hidden" onChange={(e) => p.onLoadVideo(e.target.files?.[0])} />
        </label>
        <HeaderBtn onClick={p.onSave} icon={<Save size={14} />} label="Guardar" disabled={p.busy === 'save'} />
        <HeaderBtn onClick={p.onExtract} icon={<BarChart3 size={14} />} label="Extraer" disabled={p.busy === 'extract'} />
        <button onClick={p.onExport} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm" style={{ background: C.amber, color: '#0E1420', fontWeight: 600 }}>
          <Download size={14} /> Exportar
        </button>
      </div>
    </div>
  );
}

function Digit({ v, color }: { v: number; color: string }) {
  return <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color, minWidth: 34, textAlign: 'center' }}>{String(v).padStart(2, '0')}</span>;
}
function TeamName({ color, name, align }: { color: string; name: string; align: 'left' | 'right' }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5" style={{ flexDirection: align === 'right' ? 'row-reverse' : 'row', maxWidth: 170 }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="truncate" style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{name}</span>
    </div>
  );
}
function HeaderBtn({ onClick, icon, label, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted, opacity: disabled ? 0.5 : 1 }}>
      {icon} {label}
    </button>
  );
}
