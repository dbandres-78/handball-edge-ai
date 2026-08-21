'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import type { Season, RosterPlayer, RosterPlayerPatch } from './types';
import { PhotoUploader } from './PhotoUploader';

const INPUT: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.line}`, color: C.text,
  padding: '6px 8px', borderRadius: 6, fontSize: 13,
};
const COLS = '40px 48px 1fr 64px 56px 30px';

/**
 * Alta y edición de plantilla SIN depender de partidos jugados. La ficha de club (arriba)
 * solo existe una vez hay partidos enlazados a una temporada; esto cubre el hueco: un club
 * recién creado necesita poder tener jugadores desde el minuto uno. Usa las temporadas
 * GLOBALES del catálogo (/api/catalog/seasons), no las derivadas de partidos, y los mismos
 * endpoints de plantilla que ya usa el alta de partido (team-roster.tsx).
 */
export function ClubRosterManager({ clubId }: { clubId: string }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [newSeason, setNewSeason] = useState('');
  const [addingSeason, setAddingSeason] = useState(false);

  const [roster, setRoster] = useState<RosterPlayer[] | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [nNumber, setNNumber] = useState(1);
  const [nName, setNName] = useState('');
  const [nGk, setNGk] = useState(false);
  const [busyAdd, setBusyAdd] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/catalog/seasons').then((r) => r.json()).then((d: { seasons: Season[] }) => {
      if (!alive) return;
      const list = d.seasons ?? [];
      setSeasons(list);
      setSeason((cur) => cur ?? (list.length ? list[list.length - 1].code : null));
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!season) { setRoster(null); return; }
    let alive = true;
    setLoadingRoster(true);
    fetch(`/api/catalog/clubs/${clubId}/roster?season=${encodeURIComponent(season)}`)
      .then((r) => r.json())
      .then((d: { roster: RosterPlayer[] }) => { if (alive) setRoster(d.roster ?? []); })
      .finally(() => { if (alive) setLoadingRoster(false); });
    return () => { alive = false; };
  }, [clubId, season, reloadKey]);

  const createSeason = async () => {
    const code = newSeason.trim();
    if (!code) return;
    setAddingSeason(true);
    try {
      const res = await fetch('/api/catalog/seasons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (res.ok) {
        setSeasons((s) => {
          const list = s ? [...s.filter((x) => x.code !== d.season.code), d.season] : [d.season];
          return list.sort((a, b) => a.code.localeCompare(b.code));
        });
        setSeason(d.season.code);
        setNewSeason('');
      }
    } finally {
      setAddingSeason(false);
    }
  };

  const addPlayer = async () => {
    if (!season || !nName.trim()) return;
    setBusyAdd(true);
    try {
      const res = await fetch(`/api/catalog/clubs/${clubId}/roster`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season, number: nNumber, name: nName.trim(), position: nGk ? 'GK' : undefined }),
      });
      if (res.ok) {
        setNName('');
        setNGk(false);
        setNNumber((n) => n + 1);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBusyAdd(false);
    }
  };

  const patchPlayer = async (id: string, patch: RosterPlayerPatch) => {
    await fetch(`/api/catalog/players/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    setReloadKey((k) => k + 1);
  };

  const removePlayer = async (id: string) => {
    await fetch(`/api/catalog/players/${id}`, { method: 'DELETE' });
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>TEMPORADA</span>
        {(seasons ?? []).map((s) => {
          const on = s.code === season;
          return (
            <button key={s.code} onClick={() => setSeason(s.code)} className="px-2.5 py-1 rounded-md text-sm"
              style={{ fontFamily: MONO, background: on ? C.amber : C.panel2, color: on ? '#0E1420' : C.muted, border: `1px solid ${on ? C.amber : C.line}`, fontWeight: on ? 700 : 500 }}>
              {s.code}
            </button>
          );
        })}
        <input value={newSeason} onChange={(e) => setNewSeason(e.target.value)} placeholder="26/27"
          onKeyDown={(e) => { if (e.key === 'Enter') createSeason(); }}
          style={{ ...INPUT, width: 74, fontFamily: MONO }} />
        <button disabled={addingSeason || !newSeason.trim()} onClick={createSeason}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs"
          style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>
          {addingSeason ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Temporada
        </button>
      </div>

      {!season ? (
        <div className="text-center py-8 rounded-lg" style={{ color: C.faint, fontSize: 13, border: `1px dashed ${C.line}` }}>
          Crea una temporada arriba para empezar a dar de alta la plantilla.
        </div>
      ) : loadingRoster ? (
        <div className="flex items-center gap-2 py-8" style={{ color: C.faint }}>
          <Loader2 size={15} className="animate-spin" /> Cargando plantilla…
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="grid items-center gap-2" style={{ gridTemplateColumns: COLS, fontSize: 10, color: C.faint }}>
            <span /><span>Dorsal</span><span>Nombre</span><span>Posición</span><span>Activo</span><span />
          </div>

          {(roster ?? []).length === 0 && (
            <div className="text-center py-4" style={{ color: C.faint, fontSize: 12 }}>Sin jugadores todavía en esta temporada.</div>
          )}
          {(roster ?? []).map((p) => (
            <RosterRow key={p.id} player={p} onPatch={patchPlayer} onRemove={removePlayer} onChanged={() => setReloadKey((k) => k + 1)} />
          ))}

          <div className="grid items-center gap-2 mt-2 pt-2" style={{ gridTemplateColumns: COLS, borderTop: `1px solid ${C.line}` }}>
            <span title="La foto se sube una vez creado el jugador" style={{ textAlign: 'center', color: C.faint, fontSize: 12 }}>—</span>
            <input value={nNumber} onChange={(e) => setNNumber(Number(e.target.value.replace(/\D/g, '') || 0))}
              style={{ ...INPUT, fontFamily: MONO, textAlign: 'center' }} />
            <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Nombre del jugador"
              onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }} style={INPUT} />
            <label className="flex items-center justify-center gap-1" style={{ fontSize: 11, color: C.muted }}>
              <input type="checkbox" checked={nGk} onChange={(e) => setNGk(e.target.checked)} /> POR
            </label>
            <span />
            <button disabled={busyAdd || !nName.trim()} onClick={addPlayer} title="Añadir jugador"
              className="flex items-center justify-center rounded-md"
              style={{ height: 28, background: C.amber, color: '#0E1420' }}>
              {busyAdd ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RosterRow({ player, onPatch, onRemove, onChanged }: {
  player: RosterPlayer;
  onPatch: (id: string, patch: RosterPlayerPatch) => void;
  onRemove: (id: string) => void;
  onChanged: () => void;
}) {
  const [number, setNumber] = useState(player.number);
  const [name, setName] = useState(player.name);
  const gk = player.position === 'GK';

  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: COLS }}>
      <PhotoUploader src={player.photoUrl} uploadUrl={`/api/catalog/players/${player.id}/photo`} size={36}
        alt={player.name} onUploaded={onChanged} onRemoved={onChanged} />
      <input value={number} onChange={(e) => setNumber(Number(e.target.value.replace(/\D/g, '') || 0))}
        onBlur={() => { if (number !== player.number) onPatch(player.id, { number }); }}
        style={{ ...INPUT, fontFamily: MONO, textAlign: 'center', opacity: player.active ? 1 : 0.5 }} />
      <input value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const t = name.trim(); if (t && t !== player.name) onPatch(player.id, { name: t }); }}
        style={{ ...INPUT, opacity: player.active ? 1 : 0.5 }} />
      <label className="flex items-center justify-center gap-1" style={{ fontSize: 11, color: C.muted }}>
        <input type="checkbox" checked={gk} onChange={(e) => onPatch(player.id, { position: e.target.checked ? 'GK' : '' })} /> POR
      </label>
      <label className="flex items-center justify-center" title={player.active ? 'Dar de baja' : 'Dar de alta'}>
        <input type="checkbox" checked={player.active} onChange={(e) => onPatch(player.id, { active: e.target.checked })} style={{ accentColor: C.pos }} />
      </label>
      <button onClick={() => onRemove(player.id)} style={{ color: C.faint, justifySelf: 'center' }} title="Quitar de esta temporada">
        <Trash2 size={13} />
      </button>
    </div>
  );
}
