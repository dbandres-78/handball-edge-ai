'use client';
import { PALETTE as C, MONO } from '@/lib/theme';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Selección de club + plantilla desde el catálogo, compartida por los dos altas de partido
 * (vídeo y directo). Una sola fuente: eliges un club existente (precarga su plantilla de la
 * temporada) o creas uno nuevo; al crear el partido, club y jugadores quedan guardados en el
 * catálogo y reutilizables. Extraído de NewVideoMatch para que directo tenga lo mismo.
 */

export interface Club { id: string; name: string }
export interface RosterRow { number: number; name: string; gk: boolean; playerId?: string }
export interface SideState {
  clubId: string | null; clubName: string; isNew: boolean; roster: RosterRow[]; loading: boolean;
}

export const NEW_CLUB = '__new__';
const JSON_HEADERS = { 'content-type': 'application/json' };

export const emptySide = (): SideState => ({ clubId: null, clubName: '', isNew: false, roster: [], loading: false });
export const blankRow = (number: number, gk: boolean): RosterRow => ({ number, name: '', gk });
export const nextNumber = (roster: RosterRow[]) => (roster.length ? Math.max(...roster.map((r) => r.number)) + 1 : 1);

/** Catálogo de clubes (para poblar los desplegables). */
export async function fetchClubs(): Promise<Club[]> {
  const r = await fetch('/api/catalog/clubs');
  const d = await r.json().catch(() => ({ clubs: [] }));
  return d.clubs ?? [];
}

/** Plantilla de un club para una temporada, mapeada a filas editables. */
export async function loadRoster(clubId: string, season: string): Promise<RosterRow[]> {
  const r = await fetch(`/api/catalog/clubs/${clubId}/roster?season=${encodeURIComponent(season)}`);
  const d = await r.json().catch(() => ({ roster: [] }));
  return (d.roster ?? []).map((p: any) => ({ number: p.number, name: p.name, gk: p.position === 'GK', playerId: p.id }));
}

/** Asegura que la temporada existe en el catálogo (idempotente). */
export async function ensureSeason(season: string): Promise<void> {
  await fetch('/api/catalog/seasons', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ code: season }) });
}

/** Handler compartido del desplegable de club: vacío / nuevo / existente (precarga plantilla). */
export async function pickClub(
  setSide: (u: (s: SideState) => SideState) => void,
  clubs: Club[], season: string, value: string,
): Promise<void> {
  if (value === '') { setSide(() => emptySide()); return; }
  if (value === NEW_CLUB) { setSide(() => ({ clubId: null, clubName: '', isNew: true, roster: [blankRow(1, true)], loading: false })); return; }
  const club = clubs.find((c) => c.id === value);
  if (!club) return;
  setSide((s) => ({ ...s, clubId: club.id, clubName: club.name, isNew: false, loading: true }));
  const roster = await loadRoster(club.id, season);
  setSide((s) => ({ ...s, roster: roster.length ? roster : [blankRow(1, true)], loading: false }));
}

/**
 * Resuelve un lado contra el catálogo: crea el club si es nuevo y da de alta los jugadores sin
 * `playerId` (quedan reutilizables). Devuelve el payload que espera POST /api/matches.
 */
export async function resolveSide(side: SideState, season: string): Promise<{ name: string; clubId: string; players: RosterRow[] }> {
  let clubId = side.clubId;
  if (!clubId) {
    const r = await fetch('/api/catalog/clubs', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ name: side.clubName.trim() }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el club');
    clubId = d.club.id;
  }
  const players: RosterRow[] = [];
  for (const row of side.roster) {
    if (!row.name.trim()) continue;
    if (row.playerId) { players.push(row); continue; }
    const r = await fetch(`/api/catalog/clubs/${clubId}/roster`, {
      method: 'POST', headers: JSON_HEADERS,
      body: JSON.stringify({ season, number: row.number, name: row.name.trim(), position: row.gk ? 'GK' : undefined }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar un jugador');
    players.push({ ...row, playerId: d.player.id });
  }
  return { name: side.clubName.trim(), clubId: clubId!, players };
}

export const PICKER_INPUT: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.line}`, color: C.text,
  padding: '8px 10px', borderRadius: 6, fontSize: 14, width: '100%',
};

/** Panel de un equipo: desplegable de club + filas de plantilla editables. */
export function TeamRosterPicker({ title, color, side, setSide, clubs, onPickClub }: {
  title: string; color: string; side: SideState; setSide: (u: (s: SideState) => SideState) => void;
  clubs: Club[]; onPickClub: (value: string) => void;
}) {
  const setRow = (i: number, patch: Partial<RosterRow>) =>
    setSide((s) => ({ ...s, roster: s.roster.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addRow = () => setSide((s) => ({ ...s, roster: [...s.roster, blankRow(nextNumber(s.roster), false)] }));
  const delRow = (i: number) => setSide((s) => ({ ...s, roster: s.roster.filter((_, j) => j !== i) }));

  const selectValue = side.isNew ? NEW_CLUB : (side.clubId ?? '');

  return (
    <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.muted }}>{title.toUpperCase()}</span>
      </div>

      <select value={selectValue} onChange={(e) => onPickClub(e.target.value)} style={{ ...PICKER_INPUT, marginBottom: 8 }}>
        <option value="">— Elegir club —</option>
        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        <option value={NEW_CLUB}>➕ Club nuevo…</option>
      </select>

      {side.isNew && (
        <input autoFocus value={side.clubName} onChange={(e) => setSide((s) => ({ ...s, clubName: e.target.value }))}
          placeholder="Nombre del club nuevo" style={{ ...PICKER_INPUT, marginBottom: 8 }} />
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
                style={{ ...PICKER_INPUT, fontFamily: MONO, padding: '5px 6px', textAlign: 'center' }} />
              <input value={row.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Nombre"
                style={{ ...PICKER_INPUT, padding: '5px 8px' }} />
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
