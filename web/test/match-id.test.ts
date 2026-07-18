import assert from 'node:assert/strict';
import { newMatchId } from '../features/matches/repository';

/**
 * Regresión: newMatchId con resolución de 1 segundo colisionaba en la clave primaria
 * de `match` al crear dos partidos en el mismo segundo. Detectado contra Postgres real
 * (verify:pg + import:j24 ejecutados seguidos). El sufijo aleatorio lo evita.
 */

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test('200 ids generados en el mismo instante son todos distintos', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 200; i++) ids.add(newMatchId('VID'));
  assert.equal(ids.size, 200);
});

test('el id conserva el prefijo y la marca temporal legible', () => {
  const id = newMatchId('LIVE');
  assert.match(id, /^LIVE-\d{8}-\d{6}-[a-z0-9]+$/);
});

test('prefijos distintos no se mezclan', () => {
  assert.ok(newMatchId('VID').startsWith('VID-'));
  assert.ok(newMatchId('LIVE').startsWith('LIVE-'));
});

console.log(`${passed} passed, 0 failed`);
