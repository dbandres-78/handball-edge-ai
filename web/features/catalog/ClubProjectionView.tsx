'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, User, Link2, X, Check, Trash2, AlertTriangle } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import type { ClubProjection, PlayerCard } from './projection';
import type { RosterPlayerRef } from './types';

interface Payload {
  club: { id: string; name: string };
  seasons: string[];
  season: string | null;
  projection: ClubProjection | null;
}

const P = (v: number | null) => (v == null ? '—' : `${v}%`);
const N = (v: number | null) => (v == null ? '—' : `${v}`);

export function ClubProjectionView({ clubId }: { clubId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const q = season ? `?season=${encodeURIComponent(season)}` : '';
    fetch(`/api/catalog/clubs/${clubId}/projection${q}`)
      .then((r) => r.json())
      .then((d: Payload) => { if (alive) { setData(d); setSeason(d.season); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, season, reloadKey]);

  const proj = data?.projection ?? null;

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <Link href="/clubs" className="flex items-center gap-1.5 mb-4" style={{ fontSize: 12, color: C.muted }}>
        <ArrowLeft size={14} /> Clubes
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{data?.club.name ?? 'Club'}</h1>
        {data && data.seasons.length > 0 && (
          <div className="flex items-center gap-1">
            {data.seasons.map((s) => {
              const on = s === season;
              return (
                <button key={s} onClick={() => setSeason(s)} className="px-2.5 py-1 rounded-md text-sm"
                  style={{ fontFamily: MONO, background: on ? C.amber : C.panel2, color: on ? '#0E1420' : C.muted, border: `1px solid ${on ? C.amber : C.line}`, fontWeight: on ? 700 : 500 }}>
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12" style={{ color: C.faint }}><Loader2 size={16} className="animate-spin" /> Cargando fichas…</div>
      ) : !proj || proj.games === 0 ? (
        <div className="text-center py-12 rounded-lg mt-4" style={{ color: C.faint, fontSize: 13, border: `1px dashed ${C.line}` }}>
          Este club aún no tiene partidos enlazados en esta temporada. Da de alta partidos con su plantilla para ver las fichas.
        </div>
      ) : (
        <>
          <TeamCardView proj={proj} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '18px 0 8px' }}>Fichas de jugador</h2>
          <div className="flex flex-col gap-1.5">
            {proj.players.map((pl) => <PlayerRow key={pl.playerId} pl={pl} onChanged={() => setReloadKey((k) => k + 1)} />)}
          </div>
        </>
      )}
    </div>
  );
}

function TeamCardView({ proj }: { proj: ClubProjection }) {
  const t = proj.team;
  return (
    <div className="p-4 rounded-lg mt-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>FICHA DE EQUIPO · {proj.season}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{t.games} partidos</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Play Score equipo" value={`${t.playScoreTotal}`} sub={`${N(t.playScoreAvg)}/pt`} big />
        <Stat label="Récord (V-E-D)" value={`${t.wins}-${t.draws}-${t.losses}`} big />
        <Stat label="Goles a favor /pt" value={N(t.goalsForAvg)} sub={`${t.goalsFor} tot.`} />
        <Stat label="Goles en contra /pt" value={N(t.goalsAgainstAvg)} sub={`${t.goalsAgainst} tot.`} />
        <Stat label="Posesiones /pt" value={N(t.possessionsAvg)} />
        <Stat label="% pérdidas" value={P(t.turnoverPct)} />
        <Stat label="% acierto tiro" value={P(t.shootingPct)} />
        <Stat label="Ef. posicional" value={P(t.phaseEff.positional)} />
        <Stat label="Ef. contraataque" value={P(t.phaseEff.counter)} />
      </div>
      {t.ranking.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>TOP PLAY SCORE</div>
          <div className="flex flex-col gap-1">
            {t.ranking.map((r, i) => (
              <div key={r.playerId} className="flex items-center gap-2" style={{ fontSize: 13 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, width: 16 }}>{i + 1}.</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.text }}>#{r.number}</span>
                <span className="flex-1 truncate" style={{ color: C.muted }}>{r.name}</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: C.amber }}>{r.playScoreTotal}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ pl, onChanged }: { pl: PlayerCard; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="rounded-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-2.5 text-left">
        {open ? <ChevronDown size={15} color={C.faint} /> : <ChevronRight size={15} color={C.faint} />}
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.text, width: 34 }}>#{pl.number}</span>
        <span className="flex-1 truncate" style={{ fontSize: 14, color: C.text }}>{pl.name}</span>
        <span style={{ fontSize: 11, color: C.faint }}>{pl.games} pt</span>
        <span className="text-right" style={{ minWidth: 70 }}>
          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.amber }}>{pl.playScoreTotal}</span>
          <span style={{ fontSize: 10, color: C.faint }}> PS · {N(pl.playScoreAvg)}/pt</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-2">
            <Stat label="Play Score" value={`${pl.playScoreTotal}`} sub={`${N(pl.playScoreAvg)}/pt`} />
            <Stat label="Minutos" value={`${pl.minutesTotal}′`} sub={`${N(pl.minutesAvg)}/pt`} />
            <Stat label="± total" value={`${pl.plusMinusTotal >= 0 ? '+' : ''}${pl.plusMinusTotal}`} sub={`${N(pl.plusMinusAvg)}/pt`} />
            <Stat label="Goles" value={`${pl.goals}`} sub={`${pl.shots} tiros`} />
            <Stat label="% acierto" value={P(pl.shotPct)} />
            <Stat label="Pérdidas" value={`${pl.turnovers}`} sub={`${P(pl.turnoverRate)} por pos.`} />
            <Stat label="Recuperaciones" value={`${pl.steals}`} />
            <Stat label="xG" value={`${pl.xg}`} />
          </div>
          <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>EFICACIA CON ÉL EN PISTA</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Stat label="Ofensiva (posic.)" value={P(pl.eff.offensive)} />
              <Stat label="Contraataque" value={P(pl.eff.counter)} />
              <Stat label="Defensa (posic.)" value={P(pl.eff.defensive)} />
              <Stat label="Repliegue" value={P(pl.eff.recovery)} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Link href={`/players/${pl.personId}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>
              <User size={13} /> Ver carrera
            </Link>
            <button onClick={() => setLinking(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
              style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.muted }}>
              <Link2 size={13} /> Vincular jugador
            </button>
            <button onClick={() => setDeleting(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ml-auto"
              style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.neg }}>
              <Trash2 size={13} /> Borrar
            </button>
          </div>
        </div>
      )}
      {linking && <LinkPlayerModal player={pl} onClose={() => setLinking(false)} />}
      {deleting && <DeletePlayerModal player={pl} onClose={() => setDeleting(false)} onDeleted={() => { setDeleting(false); onChanged(); }} />}
    </div>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.faint, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: big ? 18 : 15, fontWeight: 700, color: C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.faint }}>{sub}</div>}
    </div>
  );
}

function LinkPlayerModal({ player, onClose }: { player: PlayerCard; onClose: () => void }) {
  const [all, setAll] = useState<RosterPlayerRef[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/catalog/players').then((r) => r.json()).then((d) => { if (alive) setAll(d.players ?? []); });
    return () => { alive = false; };
  }, []);

  // Candidatos: cualquier jugador que no sea este ni ya la misma persona.
  const candidates = (all ?? []).filter((r) => r.id !== player.playerId && r.personId !== player.personId);
  const filtered = q.trim()
    ? candidates.filter((r) => `${r.name} ${r.clubName} ${r.season} ${r.number}`.toLowerCase().includes(q.trim().toLowerCase()))
    : candidates;

  const link = async (targetId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/catalog/players/${player.playerId}/link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId }),
      });
      if (res.ok) { setDone(true); setTimeout(() => { onClose(); }, 900); }
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 60 }}>
      <div className="w-full rounded-xl p-4 flex flex-col gap-3" style={{ maxWidth: 460, maxHeight: '82vh', background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Vincular #{player.number} {player.name}</span>
          <button onClick={onClose} style={{ color: C.faint }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: C.muted }}>
          Marca al mismo jugador en otro club o temporada: pasarán a compartir carrera. Es manual y reversible re-vinculando.
        </p>
        {done ? (
          <div className="flex items-center gap-2 py-6 justify-center" style={{ color: C.pos }}>
            <Check size={18} /> Vinculado
          </div>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, club o temporada…"
              className="w-full px-3 py-2 rounded-md text-sm" style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }} />
            <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: '46vh' }}>
              {all == null ? (
                <div className="flex items-center gap-2 py-6 justify-center" style={{ color: C.faint }}><Loader2 size={15} className="animate-spin" /> Cargando…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-6" style={{ color: C.faint, fontSize: 12 }}>No hay otros jugadores para vincular.</div>
              ) : filtered.map((r) => (
                <button key={r.id} disabled={busy} onClick={() => link(r.id)}
                  className="flex items-center gap-2 p-2 rounded-md text-left" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, width: 28 }}>#{r.number}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ fontSize: 13, color: C.text }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: C.faint }}>{r.clubName} · {r.season}</span>
                  </span>
                  <Link2 size={14} color={C.muted} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DeletePlayerModal({ player, onClose, onDeleted }: { player: PlayerCard; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const del = async (scope: 'season' | 'all') => {
    setBusy(true);
    try {
      const q = scope === 'all' ? '?scope=all' : '';
      const res = await fetch(`/api/catalog/players/${player.playerId}${q}`, { method: 'DELETE' });
      if (res.ok) onDeleted();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 60 }}>
      <div className="w-full rounded-xl p-4 flex flex-col gap-3" style={{ maxWidth: 420, background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={17} color={C.warn} />
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Borrar a #{player.number} {player.name}</span>
          <button onClick={onClose} className="ml-auto" style={{ color: C.faint }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: C.muted }}>
          Se elimina del catálogo y deja de aparecer en clubes y fichas. Las acciones ya anotadas en los
          partidos <b style={{ color: C.text }}>no se tocan</b>, así que la estadística de equipo queda intacta.
        </p>
        <button disabled={busy} onClick={() => del('season')} className="p-2.5 rounded-md text-left"
          style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Borrar de esta temporada</div>
          <div style={{ fontSize: 11, color: C.faint }}>Solo esta pertenencia (club + temporada actual).</div>
        </button>
        <button disabled={busy} onClick={() => del('all')} className="p-2.5 rounded-md text-left"
          style={{ background: `${C.neg}14`, border: `1px solid ${C.neg}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.neg }}>Borrar definitivamente</div>
          <div style={{ fontSize: 11, color: C.muted }}>Todas sus etapas y clubes (toda su identidad y su carrera).</div>
        </button>
        <button disabled={busy} onClick={onClose} className="py-2 rounded-md text-sm" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
          {busy ? 'Borrando…' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}
