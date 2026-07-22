'use client';
import { ShotOrigin } from '@/lib/handball/mapping';
import { PALETTE as C, MONO } from '@/lib/theme';

/**
 * Zonas de lanzamiento como SECTORES ANGULARES desde el centro de la portería.
 * Es la geometría real del balonmano: el extremo no es "una esquina", es un ángulo muy cerrado
 * (a cualquier distancia), y por eso convierte mucho menos. El 9 m centro es ángulo abierto pero
 * lejos. Modelarlo así hace que el mapa ya insinúe el xG antes de calcularlo.
 */

const CX = 110;      // centro de portería
const CY = 146;
const R6 = 46;       // 6 m
const R9 = 84;       // 9 m

// Cortes angulares (grados; 180 = izquierda, 0 = derecha)
const A = { wingL: [180, 146], left: [146, 110], center: [110, 70], right: [70, 34], wingR: [34, 0] };

const pt = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY - r * Math.sin(rad)];
};

/** Sector anular entre dos ángulos y dos radios. */
function sector(a1: number, a2: number, r1: number, r2: number): string {
  const [x1, y1] = pt(a1, r2);
  const [x2, y2] = pt(a2, r2);
  const [x3, y3] = pt(a2, r1);
  const [x4, y4] = pt(a1, r1);
  const outer = `A ${r2} ${r2} 0 0 1 ${x2} ${y2}`;
  const inner = r1 > 0 ? `A ${r1} ${r1} 0 0 0 ${x4} ${y4}` : '';
  return r1 > 0
    ? `M ${x1} ${y1} ${outer} L ${x3} ${y3} ${inner} Z`
    : `M ${CX} ${CY} L ${x1} ${y1} ${outer} Z`;
}

interface ZoneDef { key: ShotOrigin; label: string; short: string; d: string; lx: number; ly: number }

const mid = (a: number[], r: number) => pt((a[0] + a[1]) / 2, r);

export const ZONES: ZoneDef[] = [
  { key: ShotOrigin.WING_LEFT, label: 'Extremo izquierda', short: 'EI',
    d: sector(A.wingL[0], A.wingL[1], 0, R9), ...xy(mid(A.wingL, R9 * 0.62)) },
  { key: ShotOrigin.SIX_LEFT, label: '6 m izquierda', short: '6I',
    d: sector(A.left[0], A.left[1], 0, R6), ...xy(mid(A.left, R6 * 0.62)) },
  { key: ShotOrigin.SIX_CENTER, label: '6 m centro', short: '6C',
    d: sector(A.center[0], A.center[1], 0, R6), ...xy(mid(A.center, R6 * 0.62)) },
  { key: ShotOrigin.SIX_RIGHT, label: '6 m derecha', short: '6D',
    d: sector(A.right[0], A.right[1], 0, R6), ...xy(mid(A.right, R6 * 0.62)) },
  { key: ShotOrigin.WING_RIGHT, label: 'Extremo derecha', short: 'ED',
    d: sector(A.wingR[0], A.wingR[1], 0, R9), ...xy(mid(A.wingR, R9 * 0.62)) },
  { key: ShotOrigin.NINE_LEFT, label: '9 m izquierda', short: '9I',
    d: sector(A.left[0], A.left[1], R6, R9), ...xy(mid(A.left, (R6 + R9) / 2)) },
  { key: ShotOrigin.NINE_CENTER, label: '9 m centro', short: '9C',
    d: sector(A.center[0], A.center[1], R6, R9), ...xy(mid(A.center, (R6 + R9) / 2)) },
  { key: ShotOrigin.NINE_RIGHT, label: '9 m derecha', short: '9D',
    d: sector(A.right[0], A.right[1], R6, R9), ...xy(mid(A.right, (R6 + R9) / 2)) },
];

function xy([lx, ly]: number[]) { return { lx, ly }; }

export const ORIGIN_LABEL: Record<ShotOrigin, string> =
  Object.fromEntries(ZONES.map((z) => [z.key, z.label])) as Record<ShotOrigin, string>;
export const ORIGIN_SHORT: Record<ShotOrigin, string> =
  Object.fromEntries(ZONES.map((z) => [z.key, z.short])) as Record<ShotOrigin, string>;

export interface OriginHeat { shots: number; goals: number }

interface Props {
  mode?: 'input' | 'display';
  value?: ShotOrigin | null;
  onPick?: (o: ShotOrigin | null) => void;
  heat?: Partial<Record<ShotOrigin, OriginHeat>>;
  accent?: string;
  width?: number;
}

export function ShotOriginCourt({ mode = 'input', value, onPick, heat, accent = C.home, width = 200 }: Props) {
  const h = width * (150 / 220);
  const maxShots = heat ? Math.max(1, ...Object.values(heat).map((v) => v?.shots ?? 0)) : 1;

  return (
    <svg width={width} height={h} viewBox="0 0 220 150" style={{ display: 'block' }}>
      {ZONES.map((z) => {
        const active = mode === 'input' && value === z.key;
        const d = heat?.[z.key];
        const shots = d?.shots ?? 0;
        const conv = shots > 0 ? (d!.goals / shots) : 0;
        // En display, la intensidad = volumen de tiros; el color = eficacia.
        const alpha = shots > 0 ? Math.round(30 + (shots / maxShots) * 200).toString(16).padStart(2, '0') : '00';
        const color = shots > 0 ? (conv >= 0.6 ? C.goal : conv >= 0.35 ? C.amber : C.neg) : 'transparent';

        return (
          <g key={z.key}
             onClick={mode === 'input' && onPick ? () => onPick(value === z.key ? null : z.key) : undefined}
             style={{ cursor: mode === 'input' ? 'pointer' : 'default' }}>
            <title>{z.label}{heat ? ` · ${d?.goals ?? 0}/${shots}` : ''}</title>
            <path d={z.d}
              fill={heat ? (shots > 0 ? `${color}${alpha}` : 'transparent') : active ? accent : C.panel2}
              stroke={active ? accent : C.line} strokeWidth={active ? 1.6 : 0.8} />
            <text x={z.lx} y={z.ly} textAnchor="middle" dominantBaseline="middle"
              fontFamily={MONO} fontSize={heat ? 8 : 9} fontWeight="700"
              fill={active ? '#0E1420' : heat && shots > 0 ? C.text : C.faint}
              style={{ pointerEvents: 'none' }}>
              {heat ? (shots > 0 ? `${d!.goals}/${shots}` : '') : z.short}
            </text>
          </g>
        );
      })}

      {/* Línea de 9 m (discontinua, como en la pista) */}
      <path d={`M ${pt(180, R9)[0]} ${pt(180, R9)[1]} A ${R9} ${R9} 0 0 1 ${pt(0, R9)[0]} ${pt(0, R9)[1]}`}
        fill="none" stroke={C.line} strokeWidth="1" strokeDasharray="4 3" />
      {/* Línea de 6 m */}
      <path d={`M ${pt(180, R6)[0]} ${pt(180, R6)[1]} A ${R6} ${R6} 0 0 1 ${pt(0, R6)[0]} ${pt(0, R6)[1]}`}
        fill="none" stroke={C.line} strokeWidth="1" />
      {/* Línea de fondo y portería */}
      <line x1="8" y1={CY} x2="212" y2={CY} stroke={C.line} strokeWidth="1" />
      <rect x={CX - 15} y={CY - 1} width="30" height="4" rx="1" fill={C.amber} />
    </svg>
  );
}
