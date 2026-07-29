import assert from 'node:assert/strict';
import { EventType, ShotOutcome } from '@handball/core';
import { liveStats, UiEvent, UiTeam } from '../lib/handball/mapping';
import { buildStatsCsv, statsCsvFilename } from '../lib/handball/stats-csv';

const home: UiTeam = { name: 'BM Óviedo', players: [
  { number: 1, name: 'Áng. Portero', gk: true }, { number: 7, name: 'B. Lateral' },
] };
const away: UiTeam = { name: 'Rival; S.D.', players: [   // nombre con ';' a propósito
  { number: 12, name: 'G. Portero', gk: true }, { number: 9, name: 'H. Pivote' },
] };

let id = 0;
const e = (t: number, side: 'HOME' | 'AWAY', num: number | null,
  type: EventType, outcome: ShotOutcome | null = null, zone: number | null = null): UiEvent =>
  ({ id: id++, t, period: 1, side, playerNumber: num, type, outcome, zone });

const meta = { competition: 'Liga ASOBAL', matchday: 22, playedAt: '2026-03-02T17:00:00.000Z' };

const events: UiEvent[] = [
  e(100, 'HOME', 7, EventType.SHOT, ShotOutcome.GOAL, 3),
  e(200, 'HOME', 7, EventType.SHOT, ShotOutcome.MISSED),
  e(300, 'AWAY', 9, EventType.SHOT, ShotOutcome.GOAL, 5),
  e(150, 'HOME', null, EventType.NEAR_PASS),
];
const stats = liveStats(meta, events, home, away);
const csv = buildStatsCsv(stats);
const lines = csv.split('\r\n');

let pass = 0, fail = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
};

check('empieza con BOM UTF-8 (acentos legibles en Excel)', () => {
  assert.equal(csv.charCodeAt(0), 0xFEFF);
});

check('cabecera con equipos, resultado, competición y jornada', () => {
  assert.ok(csv.includes('BM Óviedo vs'));
  assert.ok(lines.some((l) => l.startsWith('Resultado;1-1')));
  assert.ok(lines.some((l) => l.includes('Liga ASOBAL')));
  assert.ok(lines.some((l) => l.startsWith('Jornada;22')));
});

check('bloque EQUIPOS con los pases a 10 m', () => {
  const header = lines.find((l) => l.startsWith('Equipo;Goles'))!;
  assert.ok(header.includes('Pases 10m'));
  const homeRow = lines.find((l) => l.startsWith('BM Óviedo;'))!;
  assert.ok(homeRow.split(';').includes('1'));   // 1 pase a 10m (columna Pases 10m)
});

check('bloque JUGADORES incluye +/- y Play Score', () => {
  const header = lines.find((l) => l.startsWith('Equipo;Dorsal'))!;
  assert.ok(header.includes('+/-'));
  assert.ok(header.includes('Play Score'));
  assert.ok(header.includes('PS ajustado'));
  assert.ok(header.includes('PS prior'));
});

check('los nombres con ; se entrecomillan (no rompen columnas)', () => {
  // El equipo visitante se llama "Rival; S.D." → debe ir entre comillas.
  assert.ok(csv.includes('"Rival; S.D."'));
});

check('hay una fila por jugador con datos', () => {
  const b7 = lines.find((l) => l.includes(';7;B. Lateral;'));
  assert.ok(b7, 'falta la fila del jugador 7');
  assert.ok(b7!.split(';').includes('1')); // 1 gol
});

check('el nombre de archivo es seguro', () => {
  const fn = statsCsvFilename(stats);
  assert.ok(fn.startsWith('informe_'));
  assert.ok(fn.endsWith('.csv'));
  assert.ok(!/[;\/\\]/.test(fn));
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
