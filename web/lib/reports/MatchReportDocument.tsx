import React from 'react';
import {
  Document, Page, View, Text, StyleSheet, Svg, Rect, Line,
} from '@react-pdf/renderer';
import { ShotOrigin, TacticalContext, TurnoverReason } from '@handball/core';
import type { LiveStats, TeamSummary, PlayerLine, Side } from '../handball/mapping';
import { ORIGIN_LABEL } from '@/features/analysis/ShotOriginCourt';
import { TACTICAL_CONTEXT_LABEL, TURNOVER_REASON_LABEL } from '../handball/actions';

/**
 * Informe de partido en PDF — v1.
 *
 * Cubre lo que ya es "directo" o "agregación nueva" según el cruce de referencias en
 * `claude/hacia_el_informe_ideal.md` (sección 7.3 del documento del proyecto): resumen
 * comparativo, zonas de lanzamiento, mapa de gol 3x3, Sistema de Partido (combinación
 * táctica), motivo de la pérdida, rendimiento individual (con Play Score), plus/minus y
 * porteros. Deja fuera (v2, no bloquean esto): el cronograma por bloques de 5 minutos y
 * la serie partido a partido para el informe de equipo/temporada, que necesitan una
 * agregación nueva que todavía no existe.
 *
 * Genera en cliente (igual que el CSV de `StatsPanel.tsx`): `pdf(<MatchReportDocument .../>).toBlob()`.
 * Sin dependencias de servidor ni de navegador headless — ver la opción 2 recomendada en la
 * sección 8 del documento del proyecto.
 */

// ── Paleta — mismos acentos que la app (lib/theme.ts), pero sobre fondo claro para imprimir ──
const COLOR = {
  ink: '#1A2333', muted: '#5C6980', faint: '#8B98AD', line: '#D7DEE8', panel: '#F4F6FA',
  home: '#2E6FCB', away: '#C97A1C', goal: '#1F9D5C', neg: '#C43A33', amber: '#B8790E',
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica', color: COLOR.ink },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  h2: { fontSize: 10, color: COLOR.muted, marginBottom: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6, color: COLOR.ink,
    borderBottomWidth: 1, borderBottomColor: COLOR.line, paddingBottom: 3,
  },
  row: { flexDirection: 'row' },
  scoreBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLOR.panel, borderRadius: 4, padding: 12, marginTop: 8,
  },
  teamName: { fontSize: 13, fontWeight: 700 },
  scoreNum: { fontSize: 28, fontWeight: 700, fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: COLOR.faint,
    flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLOR.line, paddingTop: 4,
  },
  kpiCard: {
    flex: 1, backgroundColor: COLOR.panel, borderRadius: 4, borderWidth: 1, borderColor: COLOR.line,
    padding: 8,
  },
  kpiLabel: { fontSize: 6.5, color: COLOR.muted, letterSpacing: 0.4, marginBottom: 4, fontWeight: 700 },
});

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
const pct = (num: number, den: number): string => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—');
const r1 = (n: number) => (Math.round(n * 10) / 10).toString();
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Footer({ stats }: { stats: LiveStats }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{stats.summary.home.name} vs {stats.summary.away.name} — Handball Edge AI</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// ── Tabla genérica: cabecera + filas, columnas con ancho fijo (flex) ──────────────────────────
interface Col<T> {
  label: string; width?: number; align?: 'left' | 'center' | 'right'; render: (row: T) => string;
  /** Color de texto dinámico (p. ej. Play Score en verde/rojo según signo). Opcional. */
  color?: (row: T) => string | undefined;
  /** Barra de progreso fina bajo el texto (0-100). Útil para %EF, %goles, etc. Opcional. */
  barPct?: (row: T) => number | null;
  barColor?: string;
}
function Table<T>({ cols, rows, accent, keyOf }: { cols: Col<T>[]; rows: T[]; accent?: string; keyOf: (r: T, i: number) => string | number }) {
  const tstyles = StyleSheet.create({
    wrap: { borderWidth: 1, borderColor: COLOR.line, borderRadius: 3, overflow: 'hidden' },
    head: { flexDirection: 'row', backgroundColor: accent ?? COLOR.panel, paddingVertical: 4, paddingHorizontal: 5 },
    headCell: { fontSize: 7.5, fontWeight: 700, color: accent ? '#FFFFFF' : COLOR.muted, letterSpacing: 0.3 },
    dataRow: { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: COLOR.line },
    dataRowAlt: { backgroundColor: COLOR.panel },
    cell: { fontSize: 8 },
    barTrack: { height: 2.5, borderRadius: 1.5, backgroundColor: COLOR.line, marginTop: 2 },
    barFill: { height: 2.5, borderRadius: 1.5 },
  });
  return (
    <View style={tstyles.wrap}>
      <View style={tstyles.head}>
        {cols.map((c, i) => (
          <Text key={i} style={[tstyles.headCell, { flex: c.width ?? 1, textAlign: c.align ?? 'left' }]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={keyOf(r, i)} style={[tstyles.dataRow, ...(i % 2 === 1 ? [tstyles.dataRowAlt] : [])]}>
          {cols.map((c, j) => {
            const barPct = c.barPct?.(r);
            return (
              <View key={j} style={{ flex: c.width ?? 1 }}>
                <Text style={[tstyles.cell, { textAlign: c.align ?? 'left', color: c.color?.(r) ?? COLOR.ink, fontWeight: c.color ? 700 : 400 }]}>
                  {c.render(r)}
                </Text>
                {barPct != null && (
                  <View style={tstyles.barTrack}>
                    <View style={[tstyles.barFill, { width: `${Math.max(0, Math.min(100, barPct))}%`, backgroundColor: c.barColor ?? COLOR.goal }]} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {rows.length === 0 && (
        <View style={[tstyles.dataRow]}><Text style={[tstyles.cell, { color: COLOR.faint }]}>Sin datos.</Text></View>
      )}
    </View>
  );
}

/** Cabecera de subsección con marca de color — más visual que un texto gris plano. */
function SectionLabel({ children, accent }: { children: string; accent: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
      <View style={{ width: 3, height: 10, backgroundColor: accent, borderRadius: 1, marginRight: 5 }} />
      <Text style={{ fontSize: 8.5, fontWeight: 700, color: COLOR.ink, letterSpacing: 0.4 }}>{children}</Text>
    </View>
  );
}

// ── Mapa de gol 3x3 (misma disposición que la app: zonas 1-9) ────────────────────────────────
function GoalMap({ goalZones, accent, label }: { goalZones: Partial<Record<number, number>>; accent: string; label: string }) {
  const size = 90, cell = size / 3;
  const max = Math.max(1, ...Object.values(goalZones).map((v) => v ?? 0));
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" stroke={COLOR.line} strokeWidth={1} />
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => {
          const zone = r * 3 + c + 1;
          const n = goalZones[zone] ?? 0;
          const alpha = n === 0 ? 0 : 0.25 + 0.65 * (n / max);
          return (
            <Rect key={zone} x={c * cell} y={r * cell} width={cell} height={cell}
              fill={accent} fillOpacity={alpha} stroke={COLOR.line} strokeWidth={0.5} />
          );
        }))}
        <Line x1={0} y1={cell} x2={size} y2={cell} stroke={COLOR.line} strokeWidth={0.5} />
        <Line x1={0} y1={cell * 2} x2={size} y2={cell * 2} stroke={COLOR.line} strokeWidth={0.5} />
        <Line x1={cell} y1={0} x2={cell} y2={size} stroke={COLOR.line} strokeWidth={0.5} />
        <Line x1={cell * 2} y1={0} x2={cell * 2} y2={size} stroke={COLOR.line} strokeWidth={0.5} />
      </Svg>
      <Text style={{ fontSize: 7, color: COLOR.muted, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

// ── Barra apilada de composición (goles/fallos/paradas/pérdidas) por jugador ──────────────────
function StackedBar({ segments, width = 70, height = 8 }: { segments: { value: number; color: string }[]; width?: number; height?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <Svg width={width} height={height}><Rect x={0} y={0} width={width} height={height} fill={COLOR.panel} /></Svg>;
  let x = 0;
  return (
    <Svg width={width} height={height}>
      {segments.map((s, i) => {
        const w = (s.value / total) * width;
        const rect = <Rect key={i} x={x} y={0} width={w} height={height} fill={s.color} />;
        x += w;
        return rect;
      })}
    </Svg>
  );
}

// ── Play Score: ranking visual del partido, barras divergentes (+verde / −rojo) ───────────────
function PlayScoreBars({ players }: { players: PlayerLine[] }) {
  const ranked = [...players].sort((a, b) => b.playScore.total - a.playScore.total);
  const max = Math.max(1, ...ranked.map((p) => Math.abs(p.playScore.total)));
  return (
    <View style={{ borderWidth: 1, borderColor: COLOR.line, borderRadius: 4, padding: 8, backgroundColor: '#FFFFFF' }}>
      {ranked.map((p, i) => {
        const val = Math.round(p.playScore.total * 10) / 10;
        const pctv = Math.min(100, (Math.abs(val) / max) * 100);
        const isPos = val >= 0;
        const isTop = i === 0 && val > 0;
        return (
          <View key={p.playerId} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i === ranked.length - 1 ? 0 : 3 }}>
            <Text style={{ width: 20, fontSize: 7, color: COLOR.faint }}>{p.number}</Text>
            <View style={{ width: 92, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 7.5, fontWeight: isTop ? 700 : 400 }}>{p.name}</Text>
              {isTop && (
                <View style={{ backgroundColor: COLOR.goal, borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 4 }}>
                  <Text style={{ fontSize: 5.5, color: '#FFFFFF', fontWeight: 700 }}>MVP</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', height: 8, alignItems: 'center' }}>
              <View style={{ flex: 1, flexDirection: 'row-reverse' }}>
                {!isPos && <View style={{ width: `${pctv}%`, height: 6, backgroundColor: COLOR.neg, borderRadius: 1 }} />}
              </View>
              <View style={{ width: 1, height: 8, backgroundColor: COLOR.faint }} />
              <View style={{ flex: 1, flexDirection: 'row' }}>
                {isPos && <View style={{ width: `${pctv}%`, height: 6, backgroundColor: COLOR.goal, borderRadius: 1 }} />}
              </View>
            </View>
            <Text style={{ width: 32, textAlign: 'right', fontSize: 8, fontWeight: 700, color: isPos ? COLOR.goal : COLOR.neg }}>
              {val > 0 ? `+${val}` : `${val}`}
            </Text>
          </View>
        );
      })}
      {ranked.length === 0 && <Text style={{ fontSize: 8, color: COLOR.faint }}>Sin datos.</Text>}
    </View>
  );
}

interface KVRow { k: string; v: string }
interface KHARow { k: string; h: string; a: string }

function teamPlayers(stats: LiveStats, side: Side): PlayerLine[] {
  return stats.players.filter((p) => p.side === side).sort((a, b) => b.playScore.total - a.playScore.total || b.goals - a.goals);
}

function matchMvp(stats: LiveStats): PlayerLine | null {
  if (stats.players.length === 0) return null;
  return [...stats.players].sort((a, b) => b.playScore.total - a.playScore.total)[0];
}

const ORIGINS = [
  ShotOrigin.WING_LEFT, ShotOrigin.SIX_LEFT, ShotOrigin.SIX_CENTER, ShotOrigin.SIX_RIGHT,
  ShotOrigin.WING_RIGHT, ShotOrigin.NINE_LEFT, ShotOrigin.NINE_CENTER, ShotOrigin.NINE_RIGHT,
];
const TACTICAL = [
  TacticalContext.PERMUTA, TacticalContext.CRUCE, TacticalContext.DESDOBLAMIENTO,
  TacticalContext.CORTINA, TacticalContext.ACCION_INDIVIDUAL,
];
const REASONS = [
  TurnoverReason.FALTA_EN_ATAQUE, TurnoverReason.ROBO_DE_PASE, TurnoverReason.RECEPCION,
  TurnoverReason.PISANDO_AREA, TurnoverReason.DOBLES, TurnoverReason.PASOS,
];

function TeamSection({ stats, side }: { stats: LiveStats; side: Side }) {
  const t = side === 'HOME' ? stats.summary.home : stats.summary.away;
  const opp = side === 'HOME' ? stats.summary.away : stats.summary.home;
  const accent = side === 'HOME' ? COLOR.home : COLOR.away;
  const players = teamPlayers(stats, side);
  const goalZones: Partial<Record<number, number>> = {};
  // goalZones vive en TeamSummary ya agregado.
  Object.entries(t.goalZones).forEach(([z, n]) => { goalZones[Number(z)] = n; });

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: accent, borderBottomColor: accent }]}>{t.name}</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Table<KVRow>
            keyOf={(r) => r.k}
            cols={[{ label: 'INDICADOR', width: 2, render: (r) => r.k }, { label: 'VALOR', align: 'right', render: (r) => r.v }]}
            rows={[
              { k: 'Goles / Tiros', v: `${t.goals} / ${t.shots} (${pct(t.goals, t.shots)})` },
              { k: 'xG / xGOT', v: `${r1(t.xg)} / ${r1(t.xgot)}` },
              { k: 'Goles - xG', v: signed(Math.round((t.goals - t.xg) * 10) / 10) },
              { k: 'Paradas / % parada', v: `${t.saves} (${t.savePct != null ? Math.round(t.savePct * 100) + '%' : '—'})` },
              { k: 'Posesiones', v: `${t.possessions}` },
              { k: 'Eficacia ataque', v: pct(t.goals, t.possessions) },
              { k: '— posicional', v: `${pct(t.goalsByPhase.positional, t.possessionsByPhase.positional)} (${t.goalsByPhase.positional}/${t.possessionsByPhase.positional})` },
              { k: '— contraataque', v: `${pct(t.goalsByPhase.counter, t.possessionsByPhase.counter)} (${t.goalsByPhase.counter}/${t.possessionsByPhase.counter})` },
              { k: 'Pérdidas / Recuperaciones', v: `${t.turnovers} / ${t.steals}` },
              { k: 'Blocajes', v: `${t.blocks}` },
              { k: "Exclusiones 2' / Amarillas / Rojas", v: `${t.twoMinutes} / ${t.yellowCards} / ${t.redCards}` },
              { k: 'Tiempos muertos', v: `${t.timeouts}` },
            ]}
          />
        </View>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 110 }}>
          <GoalMap goalZones={goalZones} accent={accent} label="Mapa de gol (zona 1-9)" />
        </View>
      </View>

      <SectionLabel accent={accent}>PLAY SCORE — RANKING DEL PARTIDO</SectionLabel>
      <PlayScoreBars players={players} />

      <SectionLabel accent={accent}>ZONAS DE LANZAMIENTO</SectionLabel>
      <Table
        keyOf={(o: ShotOrigin) => o}
        rows={ORIGINS}
        cols={[
          { label: 'ZONA', width: 2, render: (o) => ORIGIN_LABEL[o] },
          { label: 'TIROS', align: 'right', render: (o) => `${t.byOrigin[o]?.shots ?? 0}` },
          { label: 'GOLES', align: 'right', render: (o) => `${t.byOrigin[o]?.goals ?? 0}` },
          {
            label: 'EF%', align: 'right', render: (o) => pct(t.byOrigin[o]?.goals ?? 0, t.byOrigin[o]?.shots ?? 0),
            barPct: (o) => { const sh = t.byOrigin[o]?.shots ?? 0; return sh > 0 ? ((t.byOrigin[o]?.goals ?? 0) / sh) * 100 : null; },
            barColor: accent,
          },
          { label: 'A PUERTA', align: 'right', render: (o) => `${t.byOrigin[o]?.onTarget ?? 0}` },
        ]}
      />

      <SectionLabel accent={accent}>SISTEMA DE PARTIDO</SectionLabel>
      <Table
        keyOf={(c: TacticalContext) => c}
        rows={TACTICAL}
        cols={[
          { label: 'COMBINACIÓN', width: 2, render: (c) => TACTICAL_CONTEXT_LABEL[c] },
          { label: 'VECES', align: 'right', render: (c) => `${(t.tacticalContext[c]?.shots ?? 0) + (t.tacticalContext[c]?.turnovers ?? 0)}` },
          { label: 'GOLES', align: 'right', render: (c) => `${t.tacticalContext[c]?.goals ?? 0}` },
          { label: 'PARADAS', align: 'right', render: (c) => `${t.tacticalContext[c]?.saved ?? 0}` },
          { label: 'PALO/FUERA', align: 'right', render: (c) => `${t.tacticalContext[c]?.missed ?? 0}` },
          { label: '7M', align: 'right', render: (c) => `${t.tacticalContext[c]?.penalties ?? 0}` },
          {
            label: '%GOLES', align: 'right', render: (c) => pct(t.tacticalContext[c]?.goals ?? 0, t.tacticalContext[c]?.shots ?? 0),
            barPct: (c) => { const sh = t.tacticalContext[c]?.shots ?? 0; return sh > 0 ? ((t.tacticalContext[c]?.goals ?? 0) / sh) * 100 : null; },
            barColor: accent,
          },
        ]}
      />

      <SectionLabel accent={accent}>MOTIVO DE LA PÉRDIDA</SectionLabel>
      <Table
        keyOf={(r: TurnoverReason) => r}
        rows={REASONS}
        cols={[
          { label: 'MOTIVO', width: 2, render: (r) => TURNOVER_REASON_LABEL[r] },
          { label: 'VECES', align: 'right', render: (r) => `${t.turnoversByReason[r] ?? 0}` },
          {
            label: '% DEL TOTAL', align: 'right', render: (r) => pct(t.turnoversByReason[r] ?? 0, t.turnovers),
            barPct: (r) => (t.turnovers > 0 ? ((t.turnoversByReason[r] ?? 0) / t.turnovers) * 100 : null),
            barColor: COLOR.amber,
          },
        ]}
      />
      <Text style={{ fontSize: 6.5, color: COLOR.faint, marginTop: 2 }}>
        {t.turnovers - Object.values(t.turnoversByReason).reduce((a, b) => a + (b ?? 0), 0)} pérdida(s) sin motivo clasificado (paso opcional saltado).
      </Text>

      <SectionLabel accent={accent}>RENDIMIENTO INDIVIDUAL</SectionLabel>
      <Table
        keyOf={(p: PlayerLine) => p.playerId}
        rows={players}
        cols={[
          { label: '#', width: 0.4, render: (p) => `${p.number}` },
          { label: 'JUGADOR', width: 2.2, render: (p) => p.name },
          { label: 'G', align: 'right', width: 0.6, render: (p) => `${p.goals}` },
          { label: 'T', align: 'right', width: 0.6, render: (p) => `${p.shots}` },
          { label: 'EF%', align: 'right', width: 0.7, render: (p) => pct(p.goals, p.shots) },
          { label: 'AS', align: 'right', width: 0.6, render: (p) => `${p.assists}` },
          { label: 'PÉRD', align: 'right', width: 0.6, render: (p) => `${p.turnovers}` },
          { label: 'REC', align: 'right', width: 0.6, render: (p) => `${p.steals}` },
          { label: 'BLQ', align: 'right', width: 0.6, render: (p) => `${p.blocks}` },
          { label: 'F.COM/PROV', align: 'right', width: 0.9, render: (p) => `${p.fouls}/${p.foulsDrawn}` },
          { label: 'xG', align: 'right', width: 0.6, render: (p) => r1(p.xg) },
          {
            label: 'PS', align: 'right', width: 0.7, render: (p) => signed(Math.round(p.playScore.total * 10) / 10),
            color: (p) => (p.playScore.total >= 0 ? COLOR.goal : COLOR.neg),
          },
        ]}
      />

      <SectionLabel accent={accent}>PLUS/MINUS Y MINUTOS</SectionLabel>
      <Table
        keyOf={(p: PlayerLine) => p.playerId}
        rows={[...players].sort((a, b) => b.plusMinus - a.plusMinus)}
        cols={[
          { label: '#', width: 0.4, render: (p) => `${p.number}` },
          { label: 'JUGADOR', width: 2.2, render: (p) => p.name },
          { label: 'MINUTOS', align: 'right', render: (p) => r1(p.minutesPlayed) },
          {
            label: '±', align: 'right', render: (p) => signed(p.plusMinus),
            color: (p) => (p.plusMinus >= 0 ? COLOR.goal : COLOR.neg),
          },
        ]}
      />

      {(() => {
        const gks = players.filter((p) => p.position === 'GK' || p.saves > 0);
        if (gks.length === 0) return null;
        return (
          <>
            <SectionLabel accent={accent}>PORTEROS</SectionLabel>
            <Table
              keyOf={(p: PlayerLine) => p.playerId}
              rows={gks}
              cols={[
                { label: '#', width: 0.4, render: (p) => `${p.number}` },
                { label: 'PORTERO', width: 2.2, render: (p) => p.name },
                { label: 'PARADAS', align: 'right', render: (p) => `${p.saves}` },
                { label: 'GOLES RECIBIDOS', align: 'right', render: () => `${opp.goals}` },
                { label: '% PARADA', align: 'right', render: (p) => pct(p.saves, p.saves + opp.goals) },
              ]}
            />
          </>
        );
      })()}

      <SectionLabel accent={accent}>COMPOSICIÓN POR JUGADOR</SectionLabel>
      <View style={{ gap: 2 }}>
        {players.filter((p) => p.shots + p.turnovers + p.saves > 0).map((p) => (
          <View key={p.playerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ width: 16, fontSize: 7.5 }}>{p.number}</Text>
            <Text style={{ width: 90, fontSize: 7.5 }}>{p.name}</Text>
            <StackedBar segments={[
              { value: p.goals, color: COLOR.goal },
              { value: p.misses, color: COLOR.neg },
              { value: p.saves, color: COLOR.home },
              { value: p.turnovers, color: COLOR.amber },
            ]} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
        {[[COLOR.goal, 'Goles'], [COLOR.neg, 'Fallos'], [COLOR.home, 'Paradas (portero)'], [COLOR.amber, 'Pérdidas']].map(([c, l]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Svg width={6} height={6}><Rect x={0} y={0} width={6} height={6} fill={c} /></Svg>
            <Text style={{ fontSize: 6.5, color: COLOR.muted }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function MatchReportDocument({ stats }: { stats: LiveStats }) {
  const sm = stats.summary;
  const mvp = matchMvp(stats);
  const mvpAccent = mvp?.side === 'HOME' ? COLOR.home : COLOR.away;
  const homeDiff = Math.round((sm.home.goals - sm.home.xg) * 10) / 10;
  const awayDiff = Math.round((sm.away.goals - sm.away.xg) * 10) / 10;
  return (
    <Document title={`Informe — ${sm.home.name} vs ${sm.away.name}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Informe de partido</Text>
        <Text style={styles.h2}>
          {sm.competition ?? 'Sin competición'}{sm.matchday ? ` · Jornada ${sm.matchday}` : ''} · {fmtDate(sm.playedAt)}
        </Text>

        <View style={styles.scoreBar}>
          <Text style={[styles.teamName, { color: COLOR.home }]}>{sm.home.name}</Text>
          <Text style={styles.scoreNum}>{sm.home.goals} – {sm.away.goals}</Text>
          <Text style={[styles.teamName, { color: COLOR.away }]}>{sm.away.name}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>EFICACIA DE TIRO</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, fontWeight: 700, color: COLOR.home }}>{pct(sm.home.goals, sm.home.shots)}</Text>
              <Text style={{ fontSize: 15, fontWeight: 700, color: COLOR.away }}>{pct(sm.away.goals, sm.away.shots)}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>BALANCE xG (GOLES - xG)</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, fontWeight: 700, color: homeDiff >= 0 ? COLOR.goal : COLOR.neg }}>{signed(homeDiff)}</Text>
              <Text style={{ fontSize: 15, fontWeight: 700, color: awayDiff >= 0 ? COLOR.goal : COLOR.neg }}>{signed(awayDiff)}</Text>
            </View>
          </View>
          <View style={[styles.kpiCard, { flex: 1.4 }]}>
            <Text style={styles.kpiLabel}>MVP DEL PARTIDO — PLAY SCORE</Text>
            {mvp ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: mvpAccent }}>#{mvp.number} {mvp.name}</Text>
                <Text style={{ fontSize: 15, fontWeight: 700, color: COLOR.goal }}>
                  {signed(Math.round(mvp.playScore.total * 10) / 10)}
                </Text>
              </View>
            ) : <Text style={{ fontSize: 9, color: COLOR.faint }}>Sin datos.</Text>}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumen comparativo</Text>
        <Table<KHARow>
          keyOf={(r) => r.k}
          cols={[
            { label: 'INDICADOR', width: 2, render: (r) => r.k },
            { label: sm.home.name, align: 'right', render: (r) => r.h },
            { label: sm.away.name, align: 'right', render: (r) => r.a },
          ]}
          rows={[
            { k: 'Goles / Tiros', h: `${sm.home.goals}/${sm.home.shots}`, a: `${sm.away.goals}/${sm.away.shots}` },
            { k: 'Eficacia de tiro', h: pct(sm.home.goals, sm.home.shots), a: pct(sm.away.goals, sm.away.shots) },
            { k: 'xG / xGOT', h: `${r1(sm.home.xg)} / ${r1(sm.home.xgot)}`, a: `${r1(sm.away.xg)} / ${r1(sm.away.xgot)}` },
            { k: 'Paradas / % parada', h: `${sm.home.saves} (${sm.home.savePct != null ? Math.round(sm.home.savePct * 100) + '%' : '—'})`, a: `${sm.away.saves} (${sm.away.savePct != null ? Math.round(sm.away.savePct * 100) + '%' : '—'})` },
            { k: 'Posesiones', h: `${sm.home.possessions}`, a: `${sm.away.possessions}` },
            { k: 'Pérdidas', h: `${sm.home.turnovers}`, a: `${sm.away.turnovers}` },
            { k: 'Recuperaciones', h: `${sm.home.steals}`, a: `${sm.away.steals}` },
            { k: 'Blocajes', h: `${sm.home.blocks}`, a: `${sm.away.blocks}` },
            { k: "Exclusiones 2'", h: `${sm.home.twoMinutes}`, a: `${sm.away.twoMinutes}` },
          ]}
        />

        <Footer stats={stats} />
      </Page>

      <Page size="A4" style={styles.page}>
        <TeamSection stats={stats} side="HOME" />
        <Footer stats={stats} />
      </Page>

      <Page size="A4" style={styles.page}>
        <TeamSection stats={stats} side="AWAY" />
        <Footer stats={stats} />
      </Page>
    </Document>
  );
}

export const matchReportFilename = (stats: LiveStats): string => {
  const sm = stats.summary;
  const safe = (s: string) => s.trim().replace(/[^a-z0-9áéíóúñü]+/gi, '_');
  const date = sm.playedAt ? new Date(sm.playedAt).toISOString().slice(0, 10) : 'sin-fecha';
  return `informe_${safe(sm.home.name)}_vs_${safe(sm.away.name)}_${date}.pdf`;
};
