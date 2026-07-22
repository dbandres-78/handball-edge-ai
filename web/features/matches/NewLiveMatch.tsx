'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, X } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';

/**
 * Alta rápida de un partido en directo: lo mínimo para poder empezar a anotar antes del
 * saque inicial. Las plantillas se afinan dentro de la sala, sin parar el reloj.
 */
export function NewLiveMatch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [homeName, setHomeName] = useState('');
  const [awayName, setAwayName] = useState('');
  const [competition, setCompetition] = useState('');
  const [matchday, setMatchday] = useState('');
  const [periodMinutes, setPeriodMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!homeName.trim() || !awayName.trim()) { setError('Indica los dos equipos'); return; }
    setBusy(true); setError(null);
    const r = await fetch('/api/matches', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'live', competition: competition || undefined,
        matchday: matchday ? Number(matchday) : undefined,
        periodMinutes,
        home: { name: homeName }, away: { name: awayName },
      }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(data.error ?? 'No se pudo crear el partido'); return; }
    router.push(`/matches/${data.matchId}/live`);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
        style={{ background: C.amber, color: '#0E1420', fontWeight: 600 }}>
        <Radio size={14} /> Anotar en directo
      </button>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,14,.7)', zIndex: 50 }}>
      <div className="w-full rounded-xl p-5" style={{ maxWidth: 460, background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio size={16} color={C.neg} />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Nuevo partido en directo</h2>
          </div>
          <button onClick={() => setOpen(false)} style={{ color: C.faint }}><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <Field label="Equipo local">
            <input autoFocus value={homeName} onChange={(e) => setHomeName(e.target.value)} placeholder="BM Ejemplo" style={inputStyle} />
          </Field>
          <Field label="Equipo visitante">
            <input value={awayName} onChange={(e) => setAwayName(e.target.value)} placeholder="Club rival" style={inputStyle} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Competición">
              <input value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga" style={inputStyle} />
            </Field>
            <Field label="Jornada">
              <input value={matchday} onChange={(e) => setMatchday(e.target.value.replace(/\D/g, ''))} placeholder="24" style={{ ...inputStyle, fontFamily: MONO }} />
            </Field>
            <Field label="Min. por parte">
              <select value={periodMinutes} onChange={(e) => setPeriodMinutes(Number(e.target.value))} style={{ ...inputStyle, fontFamily: MONO }}>
                {[10, 15, 20, 25, 30].map((m) => <option key={m} value={m}>{m}′</option>)}
              </select>
            </Field>
          </div>

          {error && <div style={{ fontSize: 12, color: C.neg }}>{error}</div>}

          <div style={{ fontSize: 11, color: C.faint }}>
            Se crean plantillas con dorsales 1–12 (el 1 como portero). Puedes editarlas dentro de la sala.
          </div>

          <div className="flex items-center gap-2 justify-end mt-1">
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
    </div>
  );
}

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
