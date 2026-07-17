'use client';
import { PALETTE as C, MONO } from '@/lib/theme';

interface Props {
  mode?: 'input' | 'display';
  value?: number | null;
  onPick?: (z: number | null) => void;
  counts?: Record<number, number>;
  accent?: string;
  size?: number;
}

export function GoalTarget({ mode = 'input', value, onPick, counts, accent = C.home, size = 108 }: Props) {
  const h = size * 0.72;
  const cellW = size / 3;
  const cellH = h / 3;
  const max = counts ? Math.max(1, ...Object.values(counts)) : 1;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} style={{ display: 'block' }}>
      <rect x="1" y="1" width={size - 2} height={h - 2} rx="4" fill="none" stroke={C.line} strokeWidth="2" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => {
          const z = r * 3 + c + 1;
          const x = c * cellW;
          const y = r * cellH;
          const active = mode === 'input' && value === z;
          const heat = counts ? counts[z] || 0 : 0;
          const alpha = Math.round(20 + (heat / max) * 210).toString(16).padStart(2, '0');
          return (
            <g
              key={z}
              onClick={mode === 'input' && onPick ? () => onPick(value === z ? null : z) : undefined}
              style={{ cursor: mode === 'input' ? 'pointer' : 'default' }}
            >
              <rect
                x={x + 1.5} y={y + 1.5} width={cellW - 3} height={cellH - 3} rx="2"
                fill={counts ? (heat ? `${accent}${alpha}` : 'transparent') : active ? accent : 'transparent'}
                stroke={active ? accent : C.lineSoft} strokeWidth={active ? 2 : 1}
              />
              {counts && heat > 0 && (
                <text x={x + cellW / 2} y={y + cellH / 2 + 4} textAnchor="middle" fontFamily={MONO} fontSize="12" fontWeight="700" fill={C.text}>
                  {heat}
                </text>
              )}
              {!counts && (
                <text x={x + cellW / 2} y={y + cellH / 2 + 3} textAnchor="middle" fontFamily={MONO} fontSize="9" fill={active ? '#0E1420' : C.faint}>
                  {z}
                </text>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
