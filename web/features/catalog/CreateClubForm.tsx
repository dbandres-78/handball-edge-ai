'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2 } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';

const INPUT: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.line}`, color: C.text,
  padding: '8px 10px', borderRadius: 6, fontSize: 14,
};

/**
 * Alta de club SIN necesidad de crear un partido. Antes solo existía el camino de "nuevo
 * partido con plantilla" (team-roster.tsx); este formulario cubre preparar el catálogo con
 * antelación — equipo y jugadores primero, partidos después. Al crear, navega directamente
 * a la ficha del club para dar de alta la plantilla en la pestaña "Plantilla".
 */
export function CreateClubForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Falta el nombre del club'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/catalog/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, shortName: shortName.trim() || undefined, color: color.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'No se pudo crear el club');
      router.push(`/clubs/${d.club.id}`);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo crear el club');
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg mb-4 text-sm"
        style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text, fontWeight: 600 }}>
        <Plus size={15} /> Crear club
      </button>
    );
  }

  return (
    <div className="rounded-lg p-3 mb-4 flex flex-col gap-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Club nuevo</span>
        <button onClick={() => setOpen(false)} style={{ color: C.faint }}><X size={15} /></button>
      </div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Nombre del club" style={INPUT} />
      <div className="flex gap-2">
        <input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="Siglas (opcional)"
          style={{ ...INPUT, flex: 1, fontFamily: MONO }} />
        <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#color (opcional)"
          style={{ ...INPUT, width: 130, fontFamily: MONO }} />
      </div>
      {error && <span style={{ fontSize: 12, color: C.neg }}>{error}</span>}
      <div className="flex items-center gap-2">
        <button disabled={busy} onClick={submit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
          style={{ background: C.amber, color: '#0E1420', fontWeight: 700 }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear y añadir plantilla
        </button>
        <button disabled={busy} onClick={() => setOpen(false)} style={{ fontSize: 13, color: C.muted }}>Cancelar</button>
      </div>
    </div>
  );
}
