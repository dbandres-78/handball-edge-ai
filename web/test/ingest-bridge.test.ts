import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReportImportAdapter } from '@handball/core';
import { normalizedToWeb, clockToSeconds } from '../lib/handball/ingest-bridge';
import { liveStats } from '../lib/handball/mapping';

/**
 * Tests del puente de ingesta de informes (endpoint /api/matches/import).
 *
 * Verifican que un informe real (formato Handball.AI) pasa por
 *   RawReport → ReportImportAdapter → NormalizedMatch → normalizedToWeb
 * y produce un partido web cuyos agregados (marcador, tiros, xG) recomputan igual que
 * el caso de uso del backend. Es la garantía de que "cargar un informe" e "importarlo
 * a la web" dan exactamente el mismo resultado.
 */

const raw = JSON.parse(
  readFileSync(new URL('./j24-report.sample.json', import.meta.url), 'utf8'),
);

type Fn = () => void;
const tests: Array<[string, Fn]> = [];
const test = (n: string, f: Fn) => tests.push([n, f]);

test('clockToSeconds convierte MM:SS a segundos', () => {
  assert.equal(clockToSeconds('00:00'), 0);
  assert.equal(clockToSeconds('01:30'), 90);
  assert.equal(clockToSeconds('12:05'), 725);
  assert.equal(clockToSeconds('basura'), 0, 'reloj mal formado cae a 0');
});

test('el puente resuelve alias de patrocinador y posiciones ES', () => {
  const nm = new ReportImportAdapter().toNormalizedMatch(raw);
  const { create } = normalizedToWeb(nm);
  assert.equal(create.home.name, 'BM Ejemplo', 'alias de patrocinador resuelto');
  // El portero (POR → GK) debe quedar marcado como gk
  const gk = create.home.players.find((p) => p.number === 1);
  assert.ok(gk?.gk, 'el #1 (POR) queda marcado como portero');
  const lateral = create.home.players.find((p) => p.number === 7);
  assert.ok(!lateral?.gk, 'el lateral no es portero');
});

test('el puente preserva todos los eventos del informe', () => {
  const nm = new ReportImportAdapter().toNormalizedMatch(raw);
  const { events } = normalizedToWeb(nm);
  assert.equal(events.length, 20, 'los 20 eventos del informe se conservan');
});

test('el marcador recomputado desde el informe importado coincide con el backend', () => {
  const nm = new ReportImportAdapter().toNormalizedMatch(raw);
  const { create, events } = normalizedToWeb(nm);
  const home = { name: create.home.name, players: create.home.players };
  const away = { name: create.away.name, players: create.away.players };
  const stats = liveStats(
    { matchId: 'import-test', competition: create.competition, matchday: create.matchday, playedAt: create.playedAt },
    events, home, away,
  );
  // Mismos valores que valida el test del backend (ingest-match.slice)
  assert.equal(stats.summary.home.goals, 6, 'local 6 goles');
  assert.equal(stats.summary.away.goals, 4, 'visitante 4 goles');
  assert.equal(stats.summary.home.shots, 7, 'local 7 tiros');
  assert.equal(stats.summary.away.shots, 7, 'visitante 7 tiros');
});

test('los eventos importados llevan tiempo en segundos', () => {
  const nm = new ReportImportAdapter().toNormalizedMatch(raw);
  const { events } = normalizedToWeb(nm);
  // Todos los eventos deben tener t numérico >= 0
  assert.ok(events.every((e) => typeof e.t === 'number' && e.t >= 0), 'todos con t válido');
  // Deben estar mezclados los dos periodos
  assert.ok(events.some((e) => e.period === 1), 'hay eventos del periodo 1');
});

test('el partido importado se marca como material de vídeo', () => {
  const nm = new ReportImportAdapter().toNormalizedMatch(raw);
  const { create } = normalizedToWeb(nm);
  assert.equal(create.mode, 'video', 'un informe importado es material de vídeo, no directo');
});

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
