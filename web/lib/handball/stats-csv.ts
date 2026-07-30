import type { LiveStats } from './mapping';

/**
 * Genera el informe de estadísticas del partido en CSV.
 * - Delimitador ';' (Excel/Numbers en español usan la coma como decimal).
 * - BOM UTF-8 al inicio para que los acentos y la ñ se lean bien en Excel.
 * - Tres bloques: cabecera del partido, resumen por equipo y tabla por jugador
 *   (con Play Score y plus-minus ±, que son propios de Handball Edge AI).
 *
 * Solo incluye lo que la plataforma calcula hoy. Ya se capturan posesiones y eficiencia por fase.
 * Métricas del informe de Handball.AI que aún no se capturan (superioridad/inferioridad, sistemas de
 * juego, asistencias) quedan fuera hasta que se capturen esos eventos.
 */
export function buildStatsCsv(stats: LiveStats): string {
  const D = ';';
  const cell = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (...vals: unknown[]) => vals.map(cell).join(D);
  const pct = (v: number | null) => (v == null ? '' : `${Math.round(v * 100)}%`);
  const effPct = (g: number, poss: number) => (poss > 0 ? `${Math.round((g / poss) * 100)}%` : '');
  const r1 = (v: number) => (Math.round(v * 10) / 10).toString();

  const sm = stats.summary;
  const date = sm.playedAt ? new Date(sm.playedAt).toLocaleDateString('es-ES') : '';
  const lines: string[] = [];

  // ── Cabecera ──
  lines.push(row('Handball Edge AI — Informe de partido'));
  lines.push(row('Partido', `${sm.home.name} vs ${sm.away.name}`));
  lines.push(row('Resultado', `${sm.home.goals}-${sm.away.goals}`));
  lines.push(row('Competición', sm.competition ?? ''));
  lines.push(row('Jornada', sm.matchday ?? ''));
  lines.push(row('Fecha', date));
  lines.push('');

  // ── Resumen por equipo ──
  lines.push(row('EQUIPOS'));
  lines.push(row('Equipo', 'Goles', 'Tiros', 'Paradas', '%Parada', 'Pérdidas', 'Recuperaciones',
    'Blocajes', 'Pases 10m', "Excl. 2'", 'Amarillas', 'Rojas', 'T. muertos', 'xG', 'xGOT',
    'Posesiones', 'Ef. ataque', 'Ef. posicional', 'Ef. contra'));
  for (const t of [sm.home, sm.away]) {
    lines.push(row(t.name, t.goals, t.shots, t.saves, pct(t.savePct), t.turnovers, t.steals,
      t.blocks, t.nearPasses, t.twoMinutes, t.yellowCards, t.redCards, t.timeouts, r1(t.xg), r1(t.xgot),
      t.possessions, effPct(t.goals, t.possessions),
      effPct(t.goalsByPhase.positional, t.possessionsByPhase.positional),
      effPct(t.goalsByPhase.counter, t.possessionsByPhase.counter)));
  }
  lines.push('');

  // ── Tabla por jugador ──
  lines.push(row('JUGADORES'));
  lines.push(row('Equipo', 'Dorsal', 'Nombre', 'Pos', 'Portero', 'Goles', 'Tiros', 'Fallados',
    'Paradas', 'Pérdidas', 'Recuperaciones', 'Blocajes', 'Faltas', "Excl. 2'", 'Amarillas', 'Rojas',
    '+/-', 'Play Score', 'PS ajustado', 'PS prior', 'xG', 'xGOT'));
  const teamName = (side: string) => (side === 'HOME' ? sm.home.name : sm.away.name);
  for (const pl of stats.players) {
    const isGk = pl.position === 'GK' || pl.saves > 0;
    lines.push(row(
      teamName(pl.side), pl.number, pl.name, pl.position, isGk ? 'Sí' : '',
      pl.goals, pl.shots, pl.misses, pl.saves, pl.turnovers, pl.steals, pl.blocks, pl.fouls,
      pl.twoMinutes, pl.yellowCards, pl.redCards, r1(pl.plusMinus),
      r1(pl.playScore.total), r1(pl.playScore.fittedTotal), r1(pl.playScore.priorTotal),
      r1(pl.xg), r1(pl.xgot),
    ));
  }

  return '\uFEFF' + lines.join('\r\n');
}

/** Nombre de archivo sugerido para la descarga. */
export function statsCsvFilename(stats: LiveStats): string {
  const sm = stats.summary;
  const slug = `${sm.home.name}-${sm.away.name}`.replace(/[^\w-]+/g, '_').slice(0, 60);
  return `informe_${slug}.csv`;
}
