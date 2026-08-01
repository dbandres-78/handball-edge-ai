import Link from 'next/link';
import { Library, Users, Radio, Clapperboard } from 'lucide-react';

// Paleta Campus Balonmano Ebro: rojo, azul, blanco y negro.
const EBRO = { red: '#E11D2A', blue: '#1A4FA0', white: '#F5F7FA', ink: '#0A0E16', panel: '#121826', line: '#242C3D', muted: '#8A93A6' };

const TILES = [
  { href: '/matches', title: 'Biblioteca de partidos', desc: 'Tus partidos guardados, estadística y clips.', icon: Library, accent: EBRO.blue },
  { href: '/clubs', title: 'Clubes y fichas', desc: 'Fichas de equipo y jugador por temporada y carrera.', icon: Users, accent: EBRO.red },
  { href: '/matches?new=live', title: 'Directo', desc: 'Anota un partido en vivo, acción a acción.', icon: Radio, accent: EBRO.red },
  { href: '/matches?new=video', title: 'Scouting', desc: 'Nuevo partido de vídeo: etiqueta y corta jugadas.', icon: Clapperboard, accent: EBRO.blue },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${EBRO.blue}22, transparent), radial-gradient(900px 500px at 50% 110%, ${EBRO.red}18, transparent), ${EBRO.ink}` }}>
      <div className="w-full" style={{ maxWidth: 760 }}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <span style={{ width: 12, height: 28, background: EBRO.red, borderRadius: 3 }} />
            <span style={{ width: 12, height: 28, background: EBRO.white, borderRadius: 3 }} />
            <span style={{ width: 12, height: 28, background: EBRO.blue, borderRadius: 3 }} />
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, color: EBRO.white, lineHeight: 1.05 }}>
            Handball <span style={{ color: EBRO.red }}>Edge</span> <span style={{ color: EBRO.blue }}>AI</span>
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: EBRO.muted }}>
            Análisis de balonmano: directo, scouting en vídeo, estadística y fichas.
          </p>
          <p style={{ marginTop: 4, fontSize: 12, color: EBRO.muted, letterSpacing: 1 }}>
            por <b style={{ color: EBRO.white }}>Daniel Bandrés</b> · creador
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href} className="group flex items-start gap-3 p-4 rounded-xl transition-colors"
                style={{ background: EBRO.panel, border: `1px solid ${EBRO.line}` }}>
                <span className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 42, height: 42, background: `${t.accent}1f`, border: `1px solid ${t.accent}`, color: t.accent }}>
                  <Icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 16, fontWeight: 700, color: EBRO.white }}>{t.title}</span>
                  <span className="block" style={{ fontSize: 12.5, color: EBRO.muted, marginTop: 2 }}>{t.desc}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
