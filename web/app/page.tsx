import Link from 'next/link';
import { Library, Users, Radio, Clapperboard, ArrowRight } from 'lucide-react';

// Paleta Campus Balonmano Ebro (muestreada de la animación oficial): rojo, blanco y negro.
const EBRO = {
  red: '#E3303A', redDim: '#B92730', white: '#F4F2F0', ink: '#0B0B0C',
  panel: '#141518', panelHi: '#191B1F', line: '#2A2C31', muted: '#9A9DA6', faint: '#6A6E78',
};

const TILES = [
  { href: '/matches', title: 'Biblioteca de partidos', desc: 'Tus partidos guardados, con estadística, xG y clips.', icon: Library, primary: false },
  { href: '/clubs', title: 'Clubes y fichas', desc: 'Fichas de equipo y jugador por temporada, y carrera entre clubes.', icon: Users, primary: false },
  { href: '/matches?new=live', title: 'Directo', desc: 'Anota un partido en vivo, acción a acción, con auto-equipo.', icon: Radio, primary: true },
  { href: '/matches?new=video', title: 'Scouting', desc: 'Nuevo partido de vídeo: etiqueta jugadas y corta clips.', icon: Clapperboard, primary: true },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: `radial-gradient(1100px 520px at 15% -8%, ${EBRO.red}26, transparent 60%), radial-gradient(900px 500px at 100% 108%, ${EBRO.red}1a, transparent 60%), ${EBRO.ink}` }}>
      <div className="flex-1 flex flex-col w-full mx-auto px-6 sm:px-10 py-8 sm:py-12" style={{ maxWidth: 1120 }}>

        {/* Hero */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8 sm:mb-10">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span style={{ width: 16, height: 40, background: EBRO.red, borderRadius: 4 }} />
              <span style={{ width: 16, height: 40, background: EBRO.white, borderRadius: 4 }} />
              <span style={{ width: 16, height: 40, background: '#000', border: `1px solid ${EBRO.line}`, borderRadius: 4 }} />
            </div>
            <h1 style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 800, letterSpacing: -2, lineHeight: 0.98, color: EBRO.white }}>
              Handball <span style={{ color: EBRO.red }}>Edge</span> AI
            </h1>
            <p style={{ marginTop: 14, fontSize: 'clamp(14px, 1.6vw, 17px)', color: EBRO.muted, maxWidth: 560 }}>
              Plataforma de análisis de balonmano: directo, scouting en vídeo, estadística avanzada y fichas de club.
            </p>
          </div>
          <div className="sm:text-right flex-shrink-0">
            <div style={{ fontSize: 11, letterSpacing: 2, color: EBRO.faint }}>CREADO POR</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: EBRO.white }}>Daniel Bandrés</div>
          </div>
        </header>

        {/* Accesos: ocupan el alto restante */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 flex-1" style={{ minHeight: 380 }}>
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href}
                className="group relative flex flex-col justify-between rounded-2xl p-6 sm:p-8 overflow-hidden transition-transform"
                style={{
                  background: t.primary ? `linear-gradient(155deg, ${EBRO.red}, ${EBRO.redDim})` : EBRO.panel,
                  border: `1px solid ${t.primary ? EBRO.red : EBRO.line}`,
                  boxShadow: t.primary ? `0 12px 40px -18px ${EBRO.red}` : 'none',
                }}>
                <span className="flex items-center justify-center rounded-xl"
                  style={{ width: 54, height: 54,
                    background: t.primary ? 'rgba(0,0,0,.22)' : `${EBRO.red}1f`,
                    border: `1px solid ${t.primary ? 'rgba(255,255,255,.35)' : EBRO.red}`,
                    color: t.primary ? EBRO.white : EBRO.red }}>
                  <Icon size={26} />
                </span>
                <div className="mt-6">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 800, color: t.primary ? EBRO.white : EBRO.white }}>{t.title}</span>
                    <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" style={{ color: t.primary ? EBRO.white : EBRO.red }} />
                  </div>
                  <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: t.primary ? 'rgba(255,255,255,.85)' : EBRO.muted, maxWidth: 360 }}>{t.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
