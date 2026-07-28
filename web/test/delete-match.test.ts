import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import type { UiTeam } from '../lib/handball/mapping';

async function main() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const repo = makePgMatchesRepository(pool as any);
  await repo.init();

  let pass = 0, fail = 0;
  const check = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
    catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
  };

  const team = (name: string): UiTeam => ({ name, players: [{ number: 1, name: 'GK', gk: true }, { number: 7, name: 'X' }] });

  await check('delete() elimina el partido y sus datos', async () => {
    const m = await repo.create({ mode: 'video', home: team('A'), away: team('B') });
    assert.ok(await repo.get(m.matchId));                 // existe
    await repo.delete(m.matchId);
    assert.equal(await repo.get(m.matchId), null);        // ya no está
    assert.equal((await repo.list()).some((x) => x.matchId === m.matchId), false); // fuera de la lista
  });

  await check('borrar un partido no afecta a los demás', async () => {
    const keep = await repo.create({ mode: 'video', home: team('C'), away: team('D') });
    const drop = await repo.create({ mode: 'video', home: team('E'), away: team('F') });
    await repo.delete(drop.matchId);
    assert.ok(await repo.get(keep.matchId));              // el otro sobrevive
    assert.equal(await repo.get(drop.matchId), null);
  });

  await check('borrar un id inexistente no rompe', async () => {
    await repo.delete('NO-EXISTE-123');                   // no lanza
    assert.ok(true);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
