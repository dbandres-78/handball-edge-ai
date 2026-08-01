import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgCatalogRepository } from '../lib/db/catalog-repo.pg';

async function main() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const repo = makePgCatalogRepository(pool as any);
  await repo.init();

  let pass = 0, fail = 0;
  const check = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
    catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
  };

  const clubA = await repo.createClub({ name: 'Club A' });
  const clubB = await repo.createClub({ name: 'Club B' });

  await check('por defecto, cada jugador es su propia persona (person_id = id)', async () => {
    const p = await repo.addPlayer({ clubId: clubA.id, season: '25/26', number: 7, name: 'Ana' });
    assert.equal(p.personId, p.id);
  });

  await check('auto-vínculo: mismo club, dorsal y nombre en otra temporada = misma persona', async () => {
    const s1 = (await repo.listRoster(clubA.id, '25/26')).find((p) => p.number === 7)!;
    const s2 = await repo.addPlayer({ clubId: clubA.id, season: '26/27', number: 7, name: ' ana ' }); // espacios/mayúsc. no importan
    assert.equal(s2.personId, s1.personId, 'comparten identidad entre temporadas');
  });

  await check('distinto club NO se auto-vincula (hace falta vinculación manual)', async () => {
    const inA = (await repo.listRoster(clubA.id, '26/27')).find((p) => p.number === 7)!;
    const inB = await repo.addPlayer({ clubId: clubB.id, season: '26/27', number: 7, name: 'Ana' });
    assert.notEqual(inB.personId, inA.personId);
  });

  await check('mergePersons une la identidad (todo el grupo del origen pasa al destino)', async () => {
    const inA = (await repo.listRoster(clubA.id, '25/26')).find((p) => p.number === 7)!; // Club A (2 temporadas, misma persona)
    const inB = (await repo.listRoster(clubB.id, '26/27')).find((p) => p.number === 7)!; // Club B
    await repo.mergePersons(inB.id, inA.id); // B pasa a ser la misma persona que A
    const person = inA.personId;
    const career = await repo.listByPerson(person);
    // Las dos de Club A + la de Club B → 3 pertenencias de la misma persona.
    assert.equal(career.length, 3);
    const clubs = new Set(career.map((c) => c.clubId));
    assert.ok(clubs.has(clubA.id) && clubs.has(clubB.id));
  });

  await check('listAllRoster incluye el nombre del club', async () => {
    const all = await repo.listAllRoster();
    assert.ok(all.length >= 3);
    assert.ok(all.every((r) => typeof r.clubName === 'string' && r.clubName.length > 0));
  });

  await check('removePlayer borra solo esa pertenencia', async () => {
    const inA25 = (await repo.listRoster(clubA.id, '25/26')).find((p) => p.number === 7)!;
    const person = inA25.personId;
    const before = (await repo.listByPerson(person)).length;   // 3 (2 en A + 1 en B)
    await repo.removePlayer(inA25.id);
    const after = await repo.listByPerson(person);
    assert.equal(after.length, before - 1);
    assert.ok(!after.some((r) => r.id === inA25.id));
  });

  await check('removePersonPlayers borra toda la identidad', async () => {
    const any = (await repo.listRoster(clubB.id, '26/27')).find((p) => p.number === 7)!;
    await repo.removePersonPlayers(any.personId);
    assert.equal((await repo.listByPerson(any.personId)).length, 0);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
