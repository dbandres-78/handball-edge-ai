import assert from 'node:assert/strict';
import { ShotOrigin, computeXg, sumXg, DEFAULT_XG } from '@handball/core';

/**
 * Tests del xG/xGOT de referencia (primera vuelta del club).
 *
 * Comprueban:
 * - Penalti: xG fijo 0.75, fuera del juego abierto.
 * - xG depende solo de la zona de lanzamiento.
 * - xGOT solo existe si el tiro va a puerta y hay zona de portería.
 * - La colocación escala el xGOT: zona 5 (centro) lo hunde, esquinas bajas lo suben.
 */

type Fn = () => void;
const tests: Array<[string, Fn]> = [];
const test = (n: string, f: Fn) => tests.push([n, f]);
const approx = (a: number, b: number, eps = 0.001) => Math.abs(a - b) < eps;

test('penalti tiene xG fijo 0.75 sin importar zona', () => {
  const r = computeXg({ isPenalty: true, onTarget: true });
  assert.equal(r.xg, 0.75);
  assert.equal(r.xgot, 0.75);
});

test('penalti fallado (fuera) no tiene xGOT', () => {
  const r = computeXg({ isPenalty: true, onTarget: false });
  assert.equal(r.xg, 0.75);
  assert.equal(r.xgot, null);
});

test('xG depende solo de la zona de lanzamiento', () => {
  assert.equal(computeXg({ origin: ShotOrigin.SIX_CENTER, onTarget: false }).xg, 0.70);
  assert.equal(computeXg({ origin: ShotOrigin.NINE_LEFT, onTarget: false }).xg, 0.45);
  assert.equal(computeXg({ origin: ShotOrigin.WING_RIGHT, onTarget: false }).xg, 0.63);
});

test('sin zona de lanzamiento, xG = 0 (dato incompleto, no se inventa)', () => {
  const r = computeXg({ origin: null, onTarget: true, zone: 5 });
  assert.equal(r.xg, 0);
});

test('xGOT es null si el tiro no va a puerta', () => {
  const r = computeXg({ origin: ShotOrigin.SIX_CENTER, onTarget: false, zone: 1 });
  assert.equal(r.xgot, null);
});

test('xGOT es null si va a puerta pero sin zona marcada', () => {
  const r = computeXg({ origin: ShotOrigin.SIX_CENTER, onTarget: true, zone: null });
  assert.equal(r.xgot, null);
});

test('colocación en esquina baja (zona 7) sube el xGOT sobre el xG', () => {
  const r = computeXg({ origin: ShotOrigin.SIX_CENTER, onTarget: true, zone: 7 });
  // xg 0.70 * (0.835 / 0.728) = 0.803
  assert.ok(r.xgot! > r.xg, 'zona 7 es más letal que la media → xGOT > xG');
  assert.ok(approx(r.xgot!, 0.70 * (0.835 / 0.728)), `xGOT esperado ~0.803, obtenido ${r.xgot}`);
});

test('colocación en el centro (zona 5) hunde el xGOT', () => {
  const r = computeXg({ origin: ShotOrigin.SIX_CENTER, onTarget: true, zone: 5 });
  // xg 0.70 * (0.125 / 0.728) = 0.120
  assert.ok(r.xgot! < r.xg, 'zona 5 es la más parada → xGOT << xG');
  assert.ok(approx(r.xgot!, 0.70 * (0.125 / 0.728)), `xGOT esperado ~0.120, obtenido ${r.xgot}`);
});

test('zona de portería inexistente no rompe (xGOT null)', () => {
  const r = computeXg({ origin: ShotOrigin.SIX_CENTER, onTarget: true, zone: 99 });
  assert.equal(r.xgot, null);
});

test('sumXg agrega xG y xGOT de varios tiros', () => {
  const shots = [
    { origin: ShotOrigin.SIX_CENTER, onTarget: true, zone: 7 },   // xg 0.70, xgot alto
    { origin: ShotOrigin.NINE_LEFT, onTarget: false },             // xg 0.45, xgot 0
    { isPenalty: true, onTarget: true },                           // xg 0.75, xgot 0.75
  ];
  const total = sumXg(shots);
  assert.ok(approx(total.xg, 0.70 + 0.45 + 0.75), `xG total esperado 1.90, obtenido ${total.xg}`);
  // xgot: solo tiro 1 (0.803) + penalti (0.75); tiro 2 no va a puerta
  assert.ok(total.xgot > 1.5 && total.xgot < 1.6, `xGOT total ~1.55, obtenido ${total.xgot}`);
});

test('todas las zonas de lanzamiento tienen coeficiente definido', () => {
  for (const o of Object.values(ShotOrigin)) {
    assert.ok(DEFAULT_XG.xgByOrigin[o] != null, `falta xG para ${o}`);
    assert.ok(DEFAULT_XG.xgByOrigin[o] > 0 && DEFAULT_XG.xgByOrigin[o] <= 1, `xG fuera de rango para ${o}`);
  }
});

test('todas las zonas de portería 1..9 tienen factor de colocación', () => {
  for (let z = 1; z <= 9; z++) {
    assert.ok(DEFAULT_XG.placementByZone[z] != null, `falta colocación para zona ${z}`);
  }
});

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`  \u2713 ${name}`); pass++; }
  catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
