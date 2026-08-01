'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Film, X } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import {
  Club, SideState, emptySide, fetchClubs, loadRoster, ensureSeason, pickClub, resolveSide,
  TeamRosterPicker, PICKER_INPUT,
} from './team-roster';

/**
 * Alta de un partido de VÍDEO con plantillas persistentes (Fase B2).
 * Eliges temporada → por cada lado, un club del catálogo (precarga su plantilla) o uno nuevo
 * cuya plantilla escribes → al crear, el club y sus jugadores quedan guardados en el catálogo
 * (reutilizables) y el partido queda enlazado. Luego vas a la sala a cargar el vídeo y cortar.
 */
export function NewVideoMatch({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
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
    fetchClubs().then(setClubs).catch(() => {});
  }, [open]);

  // Al cambiar de temporada, recarga la plantilla de los clubes existentes ya elegidos.
  useEffect(() => {
    for (const [side, setSide] of [[home, setHome], [away, setAway]] as const) {
      if (side.clubId) loadRoster(side.clubId, season).then((roster) => setSide((s) => ({ ...s, roster: roster.length ? roster : s.roster })));
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
      await ensureSeason(s);
      const homePayload = await resolveSide(home, s);
      const awayPayload = await resolveSide(away, s);

      const r = await fetch('/api/matches', {
        method: 'POST', headers: { 'content-type': 'application/json' },
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
            <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="26/27" style={{ ...PICKER_INPUT, fontFamily: MONO }} />
          </Field>
          <Field label="Competición">
            <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga ASOBAL" style={PICKER_INPUT} />
          </Field>
          <Field label="Jornada">
            <input value={matchday} onChange={(e) => setMatchday(e.target.value.replace(/\D/g, ''))} placeholder="24" style={{ ...PICKER_INPUT, fontFamily: MONO }} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 min-h-0 overflow-y-auto pr-1">
          <TeamRosterPicker title="Local" color={C.home} side={home} setSide={setHome} clubs={clubs} onPickClub={(v) => pickClub(setHome, clubs, season, v)} />
          <TeamRosterPicker title="Visitante" color={C.away} side={away} setSide={setAway} clubs={clubs} onPickClub={(v) => pickClub(setAway, clubs, season, v)} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontSize: 11, color: C.faint }}>{label}</span>
      {children}
    </label>
  );
}
