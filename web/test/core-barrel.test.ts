import assert from 'node:assert/strict';
import * as core from '@handball/core';

/**
 * Test de sanidad del paquete @handball/core.
 *
 * Verifica que el barrel exporta la API pública completa que consumen web y backend.
 * Si alguien mueve o renombra algo del dominio y rompe el barrel, este test lo detecta
 * antes de que reviente el build de Next o el backend NestJS.
 *
 * Es la red de seguridad de la extracción a paquete: el contrato del core es explícito.
 */

type Fn = () => void;
const tests: Array<[string, Fn]> = [];
const test = (n: string, f: Fn) => tests.push([n, f]);

test('exporta los enums del dominio', () => {
  assert.ok(core.EventType, 'EventType');
  assert.ok(core.ShotOrigin, 'ShotOrigin');
  assert.ok(core.ShotOutcome, 'ShotOutcome');
  assert.ok(core.IngestionSource, 'IngestionSource');
  assert.ok(core.Position, 'Position');
});

test('exporta las funciones de Play Score', () => {
  assert.equal(typeof core.computePlayScore, 'function');
  assert.ok(core.PLAY_SCORE_WEIGHTS, 'PLAY_SCORE_WEIGHTS');
  assert.ok(core.TERM_ORIGIN, 'TERM_ORIGIN');
  assert.equal(typeof core.parseWeights, 'function');
  assert.equal(typeof core.defaultWeights, 'function');
});

test('exporta las funciones de xG', () => {
  assert.equal(typeof core.computeXg, 'function');
  assert.equal(typeof core.sumXg, 'function');
  assert.ok(core.DEFAULT_XG, 'DEFAULT_XG');
});

test('exporta recomputeAggregates', () => {
  assert.equal(typeof core.recomputeAggregates, 'function');
});

test('exporta la normalización de posiciones', () => {
  assert.equal(typeof core.normalizePosition, 'function');
});

test('exporta el caso de uso y la infraestructura framework-free', () => {
  assert.equal(typeof core.IngestMatchUseCase, 'function');
  assert.equal(typeof core.ReportImportAdapter, 'function');
  assert.equal(typeof core.InMemoryEntityResolver, 'function');
  assert.equal(typeof core.InMemoryMatchEventRepository, 'function');
  assert.equal(typeof core.InMemoryReadModelRepository, 'function');
});

test('el core es funcional end-to-end (xG real vía barrel)', () => {
  const r = core.computeXg({ origin: core.ShotOrigin.SIX_CENTER, zone: 7, onTarget: true });
  assert.equal(r.xg, 0.70);
  assert.ok(r.xgot! > r.xg, 'esquina baja sube el xGOT');
});

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
