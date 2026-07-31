import Link from 'next/link';
import { ArrowLeft, ChevronRight, Shield } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import type { Club } from './types';

export function ClubsGrid({ clubs }: { clubs: Club[] }) {
  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <Link href="/matches" className="flex items-center gap-1.5 mb-4" style={{ fontSize: 12, color: C.muted }}>
        <ArrowLeft size={14} /> Biblioteca
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Clubes y fichas</h1>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        Entra en un club para ver sus fichas por temporada: ficha de equipo y de cada jugador, agregando todos sus partidos.
      </p>

      {clubs.length === 0 ? (
        <div className="text-center py-12 rounded-lg" style={{ color: C.faint, fontSize: 13, border: `1px dashed ${C.line}` }}>
          Aún no hay clubes en el catálogo. Se crean al dar de alta partidos con plantillas o al guardarlas desde la sala.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {clubs.map((c) => (
            <Link key={c.id} href={`/clubs/${c.id}`} className="flex items-center gap-3 p-3 rounded-lg"
              style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <span className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: C.panel2, color: c.color ?? C.muted }}>
                <Shield size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{c.name}</span>
                {c.shortName && <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{c.shortName}</span>}
              </span>
              <ChevronRight size={16} color={C.faint} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
