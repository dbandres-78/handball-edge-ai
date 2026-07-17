import Link from 'next/link';
import { Radio, Film } from 'lucide-react';
import { PALETTE as C, MONO } from '@/lib/theme';
import type { MatchListItem, MatchStatus } from './types';
import { NewLiveMatch } from './NewLiveMatch';

const STATUS: Record<MatchStatus, { label: string; color: string }> = {
  new: { label: 'Sin analizar', color: C.faint },
  tagging: { label: 'En análisis', color: C.amber },
  extracted: { label: 'Con estadística', color: C.goal },
};

export function MatchLibrary({ items }: { items: MatchListItem[] }) {
  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-1 gap-3">
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Biblioteca de partidos</h1>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>{items.length} partidos</span>
          <NewLiveMatch />
        </div>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        Analiza vídeo y corta jugadas, o anota un partido en directo. La estadística es la misma en ambos casos.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((m) => {
          const st = STATUS[m.status];
          return (
            <Link key={m.matchId} href={m.mode === 'live' ? `/matches/${m.matchId}/live` : `/matches/${m.matchId}/analyze`}
              className="block rounded-lg p-4 transition-colors" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: C.faint }}>
                  {m.mode === 'live'
                    ? <><Radio size={11} color={C.neg} /><span style={{ color: C.neg, fontFamily: MONO, letterSpacing: .5 }}>DIRECTO</span></>
                    : <Film size={11} color={C.faint} />}
                  <span>{m.competition}{m.matchday ? ` · J${m.matchday}` : ''}</span>
                </span>
                <span className="flex items-center gap-1.5" style={{ fontSize: 11, color: st.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{st.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.home }} /><span className="truncate" style={{ fontSize: 14, color: C.text }}>{m.homeName}</span></div>
                  <div className="flex items-center gap-2 mt-1"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.away }} /><span className="truncate" style={{ fontSize: 14, color: C.text }}>{m.awayName}</span></div>
                </div>
                <div className="text-right flex-shrink-0 pl-3">
                  <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: C.text }}>{m.homeGoals}<span style={{ color: C.faint }}>–</span>{m.awayGoals}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{m.eventCount} ev.</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
