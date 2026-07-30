'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, X, BookMarked, Zap } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import {
  Club, SideState, emptySide, fetchClubs, loadRoster, ensureSeason, pickClub, resolveSide,
  TeamRosterPicker, PICKER_INPUT,
} from './team-roster';

type Mode = 'catalog' | 'quick';

/**
 * Alta de un partido EN DIRECTO. Dos caminos:
 *  · «Desde catálogo» (por defecto): mismos clubes/plantillas persistentes que en vídeo. El club
 *    y sus jugadores quedan guardados y reutilizables, y el partido enlazado al catálogo.
 *  · «Rápido»: solo dos nombres y dorsales genéricos, para empezar a anotar antes del saque. La
 *    plantilla se afina dentro de la sala (y en una micro-fase podrá guardarse al catálogo).
 */
export function NewLiveMatch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('catalog');

  const [season, setSeason] = useState('26/27');
  const [competition, setCompetition] = useState('');
  const [matchday, setMatchday] = useState('');
  const [periodMinutes, setPeriodMinutes] = useState(30);

  // Modo catálogo
  const [clubs, setClubs] = useState<Club[]>([]);
  const [home, setHome] = useState<SideState>(emptySide());
  const [away, setAway] = useState<SideState>(emptySide());

  // Modo rápido
  const [homeName, setHomeName] = useState('');
  const [awayName, setAwayName] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== 'catalog') return;
    fetchClubs().then(setClubs).catch(() => {});
  }, [open, mode]);

  // Al cambiar de temporada, recarga la plantilla de los clubes ya elegidos (modo catálogo).
  useEffect(() => {
    if (mode !== 'catalog') return;
    for (const [side, setSide] of [[home, setHome], [away, setAway]] as const) {
      if (side.clubId) loadRoster(side.clubId, season).then((roster) => setSide((s) => ({ ...s, roster: roster.length ? roster : s.roster })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const commonMeta = () => ({
    competition: competition || undefined,
    matchday: matchday ? Number(matchday) : undefined,
    periodMinutes,
  });

  const createFromCatalog = async () => {
    if (!home.clubName.trim() || !away.clubName.trim()) { setError('Indica los dos clubes'); return; }
    if (!home.roster.length || !away.roster.length) { setError('Cada equipo necesita al menos un jugador'); return; }
    setBusy(true); setError(null);
    try {
      const s = season.trim() || '26/27';
      await ensureSeason(s);
      const homePayload = await resolveSide(home, s);
      const awayPayload = await resolveSide(away, s);
      const r = await fetch('/api/matches', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'live', season: s, ...commonMeta(), home: homePayload, away: awayPayload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo crear el partido');
      router.push(`/matches/${d.matchId}/live`);
    } catch (e) {
      setError((e as Error).message); setBusy(false);
    }
  };

  const createQuick = async () => {
    if (!homeName.trim() || !awayName.trim()) { setError('Indica los dos equipos'); return; }
    setBusy(true); setError(null);
    const r = await fetch('/api/matches', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'live', ...commonMeta(), home: { name: homeName }, away: { name: awayName } }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? 'No se pudo crear el partido'); return; }
    router.push(`/matches/${d.matchId}/live`);
  };

  const create = () => (mode === 'catalog' ? createFromCatalog() : createQuick());

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
        style={{ background: C.amber, color: '#0E1420', fontWeight: 600 }}>
        <Radio size={14} /> Anotar en directo
      </button>
    );
  }

  const wide = mode === 'catalog';

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 50 }}>
      <div className="w-full rounded-xl p-5 flex flex-col" style={{ maxWidth: wide ? 760 : 460, maxHeight: '90vh', background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio size={16} color={C.neg} />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Nuevo partido en directo</h2>
          </div>
          <button onClick={() => setOpen(false)} style={{ color: C.faint }}><X size={16} /></button>
        </div>

        {/* Selector de modo */}
        <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
          <ModeTab active={mode === 'catalog'} onClick={() => { setMode('catalog'); setError(null); }} icon={<BookMarked size={14} />} label="Desde catálogo" hint="clubes y plantillas guardadas" />
          <ModeTab active={mode === 'quick'} onClick={() => { setMode('quick'); setError(null); }} icon={<Zap size={14} />} label="Rápido" hint="solo nombres, dorsales 1–16" />
        </div>

        {/* Meta común */}
        <div className={`grid ${wide ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mb-4`}>
          {wide && (
            <Field label="Temporada">
              <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="26/27" style={{ ...PICKER_INPUT, fontFamily: MONO }} />
            </Field>
          )}
          <Field label="Competición">
            <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga" style={PICKER_INPUT} />
          </Field>
          <Field label="Jornada">
            <input value={matchday} onChange={(e) => setMatchday(e.target.value.replace(/\D/g, ''))} placeholder="24" style={{ ...PICKER_INPUT, fontFamily: MONO }} />
          </Field>
          <Field label="Min. por parte">
            <select value={periodMinutes} onChange={(e) => setPeriodMinutes(Number(e.target.value))} style={{ ...PICKER_INPUT, fontFamily: MONO }}>
              {[10, 15, 20, 25, 30].map((m) => <option key={m} value={m}>{m}′</option>)}
            </select>
          </Field>
        </div>

        {mode === 'catalog' ? (
          <div className="grid grid-cols-2 gap-4 min-h-0 overflow-y-auto pr-1">
            <TeamRosterPicker title="Local" color={C.home} side={home} setSide={setHome} clubs={clubs} onPickClub={(v) => pickClub(setHome, clubs, season, v)} />
            <TeamRosterPicker title="Visitante" color={C.away} side={away} setSide={setAway} clubs={clubs} onPickClub={(v) => pickClub(setAway, clubs, season, v)} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Equipo local">
              <input autoFocus value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="BM Ejemplo" style={PICKER_INPUT} />
            </Field>
            <Field label="Equipo visitante">
              <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="Club rival" style={PICKER_INPUT} />
            </Field>
          </div>
        )}

        {error && <div className="mt-3" style={{ fontSize: 12, color: C.neg }}>{error}</div>}

        <div style={{ fontSize: 11, color: C.faint, marginTop: 12 }}>
          {mode === 'catalog'
            ? 'Los clubes y jugadores se guardan en el catálogo al crear, listos para reutilizar. Los titulares y el portero en pista se afinan dentro de la sala.'
            : 'Se crean plantillas con dorsales 1–16 (1 y 12 porteros). Puedes editarlas dentro de la sala sin parar el reloj.'}
        </div>

        <div className="flex items-center gap-2 justify-end mt-3">
          <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-md text-sm" style={{ color: C.muted, border: `1px solid ${C.line}` }}>
            Cancelar
          </button>
          <button onClick={create} disabled={busy} className="px-4 py-2 rounded-md text-sm"
            style={{ background: C.amber, color: '#0E1420', fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Creando…' : 'Empezar a anotar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon, label, hint }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string;
}) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-md"
      style={{ background: active ? C.panel3 : 'transparent', border: `1px solid ${active ? C.line : 'transparent'}` }}>
      <span className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600, color: active ? C.text : C.muted }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 10, color: C.faint }}>{hint}</span>
    </button>
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
