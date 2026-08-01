'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import type { PlayerCareer, PlayerCard } from './projection';

interface Payload { career: PlayerCareer | null; error?: string }

const P = (v: number | null) => (v == null ? '—' : `${v}%`);
const N = (v: number | null) => (v == null ? '—' : `${v}`);

export function PlayerCareerView({ personId }: { personId: string }) {
  const [career, setCareer] = useState<PlayerCareer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/catalog/persons/${personId}/career`)
      .then((r) => r.json())
      .then((d: Payload) => { if (alive) setCareer(d.career); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [personId]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <Link href="/clubs" className="flex items-center gap-1.5 mb-4" style={{ fontSize: 12, color: C.muted }}>
        <ArrowLeft size={14} /> Clubes
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 py-12" style={{ color: C.faint }}><Loader2 size={16} className="animate-spin" /> Cargando carrera…</div>
      ) : !career ? (
        <div className="text-center py-12 rounded-lg" style={{ color: C.faint, fontSize: 13, border: `1px dashed ${C.line}` }}>
          No se encontró la carrera de este jugador.
        </div>
      ) : (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{career.name || 'Jugador'}</h1>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            Carrera agregada de todos sus clubes y temporadas. {career.bySeason.length} etapa{career.bySeason.length === 1 ? '' : 's'}.
          </p>

          <CareerCard card={career.totals} title="TOTAL CARRERA" />

          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '18px 0 8px' }}>Por temporada y club</h2>
          <div className="flex flex-col gap-2">
            {career.bySeason.map((s) => (
              <div key={`${s.clubId}-${s.season}`} className="p-3 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} color={C.muted} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.clubName}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>{s.season}</span>
                  <Link href={`/clubs/${s.clubId}`} className="ml-auto" style={{ fontSize: 11, color: C.amber }}>ver club →</Link>
                </div>
                <CareerStats card={s.card} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CareerCard({ card, title }: { card: PlayerCard; title: string }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 11, letterSpacing: 1, color: C.faint }}>{title}</span>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>{card.games} partidos · {card.minutesTotal}′</span>
      </div>
      <CareerStats card={card} big />
    </div>
  );
}

function CareerStats({ card, big }: { card: PlayerCard; big?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        <Stat label="Play Score" value={`${card.playScoreTotal}`} sub={`${N(card.playScoreAvg)}/pt`} big={big} />
        <Stat label="Minutos" value={`${card.minutesTotal}′`} sub={`${N(card.minutesAvg)}/pt`} big={big} />
        <Stat label="± total" value={`${card.plusMinusTotal >= 0 ? '+' : ''}${card.plusMinusTotal}`} sub={`${N(card.plusMinusAvg)}/pt`} big={big} />
        <Stat label="Goles" value={`${card.goals}`} sub={`${card.shots} tiros · ${P(card.shotPct)}`} big={big} />
        <Stat label="Pérdidas" value={`${card.turnovers}`} sub={`${P(card.turnoverRate)} por pos.`} />
        <Stat label="Recuperaciones" value={`${card.steals}`} />
        <Stat label="xG" value={`${card.xg}`} />
      </div>
      <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
        <div style={{ fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>EFICACIA CON ÉL EN PISTA</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="Ofensiva (posic.)" value={P(card.eff.offensive)} />
          <Stat label="Contraataque" value={P(card.eff.counter)} />
          <Stat label="Defensa (posic.)" value={P(card.eff.defensive)} />
          <Stat label="Repliegue" value={P(card.eff.recovery)} />
        </div>
      </div>
    </>
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
