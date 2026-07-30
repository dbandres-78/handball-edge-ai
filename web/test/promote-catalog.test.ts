import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgMatchesRepository } from '../lib/db/matches-repo.pg';
import { inMemoryCatalogRepo } from '../features/catalog/repository';
import { promoteMatchToCatalog } from '../features/catalog/promote';
import type { UiTeam } from '../lib/handball/mapping';

async function main() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const matches = makePgMatchesRepository(pool as any);
  await matches.init();
  const catalog = inMemoryCatalogRepo;

  let pass = 0, fail = 0;
  const check = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
    catch (err) { console.log(`  \u2717 ${name}`); console.log(`      ${(err as Error).message}`); fail++; }
  };

  // Partido «Rápido»: sin clubId ni playerId, sin temporada.
  const rapidHome: UiTeam = { name: 'BM Rápido', players: [{ number: 1, name: 'Portero', gk: true }, { number: 7, name: 'Central' }] };
  const rapidAway: UiTeam = { name: 'CB Contrario', players: [{ number: 12, name: 'Portero V', gk: true }, { number: 9, name: 'Pivote' }] };

  let matchId = '';

  await check('promover crea clubes, da de alta jugadores y enlaza el partido + temporada', async () => {
    const m = await matches.create({ mode: 'live', home: rapidHome, away: rapidAway });
    matchId = m.matchId;
    assert.equal(m.season, undefined);
    assert.equal(m.home.clubId, undefined);

    await promoteMatchToCatalog(matches, catalog, matchId, '26/27');

    const loaded = (await matches.get(matchId))!;
    assert.equal(loaded.season, '26/27');
    assert.ok(loaded.home.clubId, 'el local queda con clubId');
    assert.ok(loaded.away.clubId, 'el visitante queda con clubId');
    const c7 = loaded.home.players.find((p) => p.number === 7)!;
    assert.ok(c7.playerId, 'el jugador 7 queda con playerId');

    // En el catálogo existen ambos clubes y sus plantillas en 26/27.
    const clubs = await catalog.listClubs();
    assert.ok(clubs.some((c) => c.name === 'BM Rápido'));
    assert.ok(clubs.some((c) => c.name === 'CB Contrario'));
    const roster = await catalog.listRoster(loaded.home.clubId!, '26/27');
    assert.equal(roster.length, 2);
    assert.ok(roster.find((r) => r.number === 1 && r.position === 'GK'), 'el 1 es portero en el catálogo');
  });

  await check('es idempotente: promover de nuevo no duplica clubes ni jugadores', async () => {
    const clubsBefore = (await catalog.listClubs()).length;
    const loadedBefore = (await matches.get(matchId))!;
    const rosterBefore = (await catalog.listRoster(loadedBefore.home.clubId!, '26/27')).length;

    await promoteMatchToCatalog(matches, catalog, matchId, '26/27');

    const clubsAfter = (await catalog.listClubs()).length;
    const loadedAfter = (await matches.get(matchId))!;
    const rosterAfter = (await catalog.listRoster(loadedAfter.home.clubId!, '26/27')).length;
    assert.equal(clubsAfter, clubsBefore, 'no se crean clubes nuevos');
    assert.equal(rosterAfter, rosterBefore, 'no se dan de alta jugadores nuevos');
    assert.equal(loadedAfter.home.clubId, loadedBefore.home.clubId, 'mismo club');
  });

  await check('un jugador nuevo sin playerId se enlaza al roster_player del mismo dorsal', async () => {
    // Club ya existente con un jugador dorsal 4 en 27/28.
    const club = await catalog.createClub({ name: 'Reutiliza CF' });
    const existing = await catalog.addPlayer({ clubId: club.id, season: '27/28', number: 4, name: 'Lateral' });

    // Partido cuyo local ES ese club (clubId) con un jugador dorsal 4 SIN playerId.
    const home: UiTeam = { name: 'Reutiliza CF', clubId: club.id, players: [{ number: 4, name: 'Lateral' }] };
    const away: UiTeam = { name: 'Otro', players: [{ number: 1, name: 'GK', gk: true }] };
    const m = await matches.create({ mode: 'live', home, away });

    const rosterBefore = (await catalog.listRoster(club.id, '27/28')).length;
    await promoteMatchToCatalog(matches, catalog, m.matchId, '27/28');
    const rosterAfter = (await catalog.listRoster(club.id, '27/28')).length;

    assert.equal(rosterAfter, rosterBefore, 'no se duplica el jugador del dorsal 4');
    const loaded = (await matches.get(m.matchId))!;
    const p4 = loaded.home.players.find((p) => p.number === 4)!;
    assert.equal(p4.playerId, existing.id, 'se enlaza al roster_player existente por dorsal');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
