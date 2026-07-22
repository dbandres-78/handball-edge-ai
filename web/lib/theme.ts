/** Paleta "sala de datos / banco de edición" — única fuente para estilos inline y tailwind.config. */
export const PALETTE = {
  bg: '#0E1420', panel: '#151D2B', panel2: '#1B2536', panel3: '#212D42',
  line: '#28344A', lineSoft: '#20293B',
  text: '#E8EDF4', muted: '#8B98AD', faint: '#5C6980',
  amber: '#F5B841', home: '#4EA1FF', away: '#F5A33C',
  goal: '#33C77A', save: '#4EA1FF', miss: '#8B98AD',
  neg: '#F0554E', warn: '#F5B841', pos: '#33C77A', neutral: '#8B98AD',
} as const;

export const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Roboto Mono', monospace";
export const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
