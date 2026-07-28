'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Film, X, Plus, Trash2 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';

/**
 * Alta de un partido de VÍDEO con plantillas persistentes (Fase B2).
 * Eliges temporada → por cada lado, un club del catálogo (precarga su plantilla) o uno nuevo
 * cuya plantilla escribes → al crear, el club y sus jugadores quedan guardados en el catálogo
 * (reutilizables) y el partido queda enlazado. Luego vas a la sala a cargar el vídeo y cortar.
 */

interface Club { id: string; name: string }
interface RosterRow { number: number; name: string; gk: boolean; playerId?: string }
interface SideState { clubId: string | null; clubName: string; roster: RosterRow[]; loading: boolean }

const emptySide = (): SideState => ({ clubId: null, clubName: '', roster: [], loading: false });
const NEW_CLUB = '__new__';

export function NewVideoMatch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState('26/27');
  const [competition, setCompetition] = useState('');
  const [matchday, setMatchday] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [home, setHome] = useState<SideState>(emptySide());
  const [away, setAway] = useState<SideState>(emptySide());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catálogo de clubes al abrir.
  useEffect(() => {
    if (!open) return;
    fetch('/api/catalog/clubs').then((r) => r.json()).then((d) => setClubs(d.clubs ?? [])).catch(() => {});
  }, [open]);

  // Cargar la plantilla de un club existente para la temporada elegida.
  const loadRoster = useCallback(async (clubId: string): Promise<RosterRow[]> => {
    const r = await fetch(`/api/catalog/clubs/${clubId}/roster?season=${encodeURIComponent(season)}`);
    const d = await r.json().catch(() => ({ roster: [] }));
    return (d.roster ?? []).map((p: any) => ({ number: p.number, name: p.name, gk: p.position === 'GK', playerId: p.id }));
  }, [season]);

  const pickClub = async (setSide: (u: (s: SideState) => SideState) => void, value: string) => {
    if (value === NEW_CLUB) { setSide(() => ({ clubId: null, clubName: '', roster: [blankRow(1, true)], loading: false })); return; }
    const club = clubs.find((c) => c.id === value);
    if (!club) return;
    setSide((s) => ({ ...s, clubId: club.id, clubName: club.name, loading: true }));
    const roster = await loadRoster(club.id);
    setSide((s) => ({ ...s, roster: roster.length ? roster : [blankRow(1, true)], loading: false }));
  };

  // Al cambiar de temporada, recarga la plantilla de los clubes existentes ya elegidos.
  useEffect(() => {
    for (const [side, setSide] of [[home, setHome], [away, setAway]] as const) {
      if (side.clubId) loadRoster(side.clubId).then((roster) => setSide((s) => ({ ...s, roster: roster.length ? roster : s.roster })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const create = async () => {
    setError(null);
    if (!home.clubName.trim() || !away.clubName.trim()) { setError('Indica los dos clubes'); return; }
    if (!home.roster.length || !away.roster.length) { setError('Cada equipo necesita al menos un jugador'); return; }
    setBusy(true);
    try {
      const s = season.trim() || '26/27';
      await fetch('/api/catalog/seasons', { method: 'POST', headers: json, body: JSON.stringify({ code: s }) });

      const resolveSide = async (side: SideState): Promise<{ name: string; clubId: string; players: RosterRow[] }> => {
        // 1) Club: existente o nuevo.
        let clubId = side.clubId;
        if (!clubId) {
          const r = await fetch('/api/catalog/clubs', { method: 'POST', headers: json, body: JSON.stringify({ name: side.clubName.trim() }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el club');
          clubId = d.club.id;
        }
        // 2) Jugadores sin playerId → se añaden al catálogo (quedan reutilizables) y capturamos su id.
        const players: RosterRow[] = [];
        for (const row of side.roster) {
          if (!row.name.trim()) continue;
          if (row.playerId) { players.push(row); continue; }
          const r = await fetch(`/api/catalog/clubs/${clubId}/roster`, {
            method: 'POST', headers: json,
            body: JSON.stringify({ season: s, number: row.number, name: row.name.trim(), position: row.gk ? 'GK' : undefined }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar un jugador');
          players.push({ ...row, playerId: d.player.id });
        }
        return { name: side.clubName.trim(), clubId: clubId!, players };
      };

      const homePayload = await resolveSide(home);
      const awayPayload = await resolveSide(away);

      const r = await fetch('/api/matches', {
        method: 'POST', headers: json,
        body: JSON.stringify({
          mode: 'video', season: s,
          competition: competition || undefined,
          matchday: matchday ? Number(matchday) : undefined,
          home: homePayload, away: awayPayload,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el partido');
      router.push(`/matches/${d.matchId}/analyze`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
        style={{ background: C.goal, color: '#0E1420', fontWeight: 600 }}>
        <Film size={14} /> Nuevo partido de vídeo
      </button>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 50 }}>
      <div className="w-full rounded-xl p-5 flex flex-col" style={{ maxWidth: 760, maxHeight: '90vh', background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Film size={16} color={C.goal} />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Nuevo partido de vídeo</h2>
          </div>
          <button onClick={() => setOpen(false)} style={{ color: C.faint }}><X size={16} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Field label="Temporada">
            <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="26/27" style={{ ...inputStyle, fontFamily: MONO }} />
          </Field>
          <Field label="Competición">
            <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga ASOBAL" style={inputStyle} />
          </Field>
          <Field label="Jornada">
            <input value={matchday} onChange={(e) => setMatchday(e.target.value.replace(/\D/g, ''))} placeholder="24" style={{ ...inputStyle, fontFamily: MONO }} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 min-h-0 overflow-y-auto pr-1">
          <TeamPanel title="Local" color={C.home} side={home} setSide={setHome} clubs={clubs} onPickClub={(v) => pickClub(setHome, v)} />
          <TeamPanel title="Visitante" color={C.away} side={away} setSide={setAway} clubs={clubs} onPickClub={(v) => pickClub(setAway, v)} />
        </div>

        {error && <div className="mt-3" style={{ fontSize: 12, color: C.neg }}>{error}</div>}

        <div style={{ fontSize: 11, color: C.faint, marginTop: 12 }}>
          Los clubes y jugadores se guardan en el catálogo al crear, listos para reutilizar. Los titulares y el portero en pista se afinan dentro de la sala.
        </div>

        <div className="flex items-center gap-2 justify-end mt-3">
          <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
            Cancelar
          </button>
          <button onClick={create} disabled={busy} className="px-4 py-2 rounded-md text-sm"
            style={{ background: C.goal, color: '#0E1420', fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Creando…' : 'Crear y cargar vídeo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamPanel({ title, color, side, setSide, clubs, onPickClub }: {
  title: string; color: string; side: SideState; setSide: (u: (s: SideState) => SideState) => void;
  clubs: Club[]; onPickClub: (value: string) => void;
}) {
  const setRow = (i: number, patch: Partial<RosterRow>) =>
    setSide((s) => ({ ...s, roster: s.roster.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addRow = () => setSide((s) => ({ ...s, roster: [...s.roster, blankRow(nextNumber(s.roster), false)] }));
  const delRow = (i: number) => setSide((s) => ({ ...s, roster: s.roster.filter((_, j) => j !== i) }));

  const selectValue = side.clubId ?? (side.clubName ? NEW_CLUB : '');

  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted }}>{title.toUpperCase()}</span>
      </div>

      <select value={selectValue} onChange={(e) => onPickClub(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
        <option value="">— Elegir club —</option>
        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        <option value={NEW_CLUB}>➕ Club nuevo…</option>
      </select>

      {(selectValue === NEW_CLUB || (!side.clubId && side.clubName)) && (
        <input autoFocus value={side.clubName} onChange={(e) => setSide((s) => ({ ...s, clubName: e.target.value }))}
          placeholder="Nombre del club nuevo" style={{ ...inputStyle, marginBottom: 8 }} />
      )}

      {side.loading ? (
        <div style={{ fontSize: 12, color: C.faint, padding: '8px 0' }}>Cargando plantilla…</div>
      ) : side.roster.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="grid items-center gap-1" style={{ gridTemplateColumns: '40px 1fr 34px 24px', fontSize: 10, color: C.faint }}>
            <span>Dorsal</span><span>Nombre</span><span>POR</span><span />
          </div>
          {side.roster.map((row, i) => (
            <div key={i} className="grid items-center gap-1" style={{ gridTemplateColumns: '40px 1fr 34px 24px' }}>
              <input value={row.number} onChange={(e) => setRow(i, { number: Number(e.target.value.replace(/\D/g, '') || 0) })}
                style={{ ...inputStyle, fontFamily: MONO, padding: '5px 6px', textAlign: 'center' }} />
              <input value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Nombre"
                style={{ ...inputStyle, padding: '5px 8px' }} />
              <input type="checkbox" checked={row.gk} onChange={(e) => setRow(i, { gk: e.target.checked })}
                title="Portero" style={{ justifySelf: 'center', accentColor: color }} />
              <button onClick={() => delRow(i)} style={{ color: C.faint, justifySelf: 'center' }} title="Quitar"><Trash2 size={13} /></button>
            </div>
          ))}
          <button onClick={addRow} className="flex items-center gap-1 mt-1" style={{ fontSize: 12, color }}>
            <Plus size={13} /> Añadir jugador
          </button>
        </div>
      )}
    </div>
  );
}

const json = { 'content-type': 'application/json' };
const blankRow = (number: number, gk: boolean): RosterRow => ({ number, name: '', gk });
const nextNumber = (roster: RosterRow[]) => (roster.length ? Math.max(...roster.map((r) => r.number)) + 1 : 1);

const inputStyle: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.line}`, color: C.text,
  padding: '8px 10px', borderRadius: 6, fontSize: 14, width: '100%',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontSize: 11, color: C.faint }}>{label}</span>
      {children}
    </label>
  );
}
