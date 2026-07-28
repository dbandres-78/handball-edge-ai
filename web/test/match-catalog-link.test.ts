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

  const home: UiTeam = {
    name: 'Balonmano Oviedo', clubId: 'CLUB-OVI',
    players: [
      { number: 1, name: 'Portero', gk: true, playerId: 'RP-OVI-1' },
      { number: 7, name: 'Central', playerId: 'RP-OVI-7' },
    ],
  };
  const away: UiTeam = {
    name: 'CB Litoral', clubId: 'CLUB-LIT',
    players: [
      { number: 12, name: 'Portero V', gk: true, playerId: 'RP-LIT-12' },
      { number: 9, name: 'Pivote', playerId: 'RP-LIT-9' },
    ],
  };

  let createdId = '';

  await check('create() persiste temporada y enlaces al catálogo (club_id, player_id)', async () => {
    const m = await repo.create({ mode: 'video', season: '26/27', home, away });
    createdId = m.matchId;
    const loaded = (await repo.get(m.matchId))!;
    assert.equal(loaded.season, '26/27');
    assert.equal(loaded.home.clubId, 'CLUB-OVI');
    assert.equal(loaded.away.clubId, 'CLUB-LIT');
    // playerId por dorsal (el portero va primero por gkFirst).
    const p7 = loaded.home.players.find((p) => p.number === 7)!;
    assert.equal(p7.playerId, 'RP-OVI-7');
    const p9 = loaded.away.players.find((p) => p.number === 9)!;
    assert.equal(p9.playerId, 'RP-LIT-9');
  });

  await check('saveRoster desde la sala (sin enlaces) NO borra club_id ni player_id', async () => {
    // Simula el autosave de la sala: mismo dorsal, editado el nombre, SIN clubId ni playerId.
    const homeEdited: UiTeam = {
      name: 'Balonmano Oviedo',
      players: [
        { number: 1, name: 'Portero', gk: true, starter: true },
        { number: 7, name: 'Central (renombrado)', starter: true },
      ],
    };
    await repo.saveRoster(createdId, homeEdited, away);
    const loaded = (await repo.get(createdId))!;
    // El enlace del club se preserva.
    assert.equal(loaded.home.clubId, 'CLUB-OVI');
    // El playerId del dorsal 7 se preserva pese a no venir en el autosave.
    const p7 = loaded.home.players.find((p) => p.number === 7)!;
    assert.equal(p7.playerId, 'RP-OVI-7');
    assert.equal(p7.name, 'Central (renombrado)');   // el nombre sí se actualiza
  });

  await check('un partido sin enlaces (flujo antiguo) sigue funcionando', async () => {
    const plain: UiTeam = { name: 'A', players: [{ number: 1, name: 'GK', gk: true }] };
    const m = await repo.create({ mode: 'live', home: plain, away: { name: 'B', players: [{ number: 1, name: 'GK', gk: true }] } });
    const loaded = (await repo.get(m.matchId))!;
    assert.equal(loaded.season, undefined);
    assert.equal(loaded.home.clubId, undefined);
    assert.equal(loaded.home.players[0].playerId, undefined);
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
