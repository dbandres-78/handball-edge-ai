import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { makePgCatalogRepository } from '../lib/db/catalog-repo.pg';
import { inMemoryCatalogRepo } from '../features/catalog/repository';

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

  await check('el catálogo arranca vacío', async () => {
    assert.equal((await repo.listSeasons()).length, 0);
    assert.equal((await repo.listClubs()).length, 0);
  });

  await check('ensureSeason crea la temporada y es idempotente', async () => {
    const a = await repo.ensureSeason('26/27', 'Temporada 2026/27');
    assert.equal(a.code, '26/27');
    const b = await repo.ensureSeason('26/27');
    assert.equal(b.code, '26/27');
    assert.equal((await repo.listSeasons()).length, 1); // no se duplica
  });

  await check('createClub persiste y getClub lo recupera', async () => {
    const club = await repo.createClub({ name: 'Balonmano Oviedo', shortName: 'OVI', color: '#1e4fff' });
    assert.ok(club.id.startsWith('CLUB-'));
    const got = await repo.getClub(club.id);
    assert.equal(got?.name, 'Balonmano Oviedo');
    assert.equal(got?.shortName, 'OVI');
  });

  await check('updateClub modifica los campos', async () => {
    const club = await repo.createClub({ name: 'Nombre viejo' });
    const upd = await repo.updateClub(club.id, { name: 'Nombre nuevo', color: '#ff8800' });
    assert.equal(upd?.name, 'Nombre nuevo');
    assert.equal(upd?.color, '#ff8800');
    assert.equal((await repo.getClub(club.id))?.name, 'Nombre nuevo');
  });

  await check('addPlayer + listRoster: la plantilla se ordena por dorsal', async () => {
    const club = await repo.createClub({ name: 'CB Litoral' });
    await repo.ensureSeason('26/27');
    await repo.addPlayer({ clubId: club.id, season: '26/27', number: 10, name: 'Central' });
    await repo.addPlayer({ clubId: club.id, season: '26/27', number: 1, name: 'Portero', position: 'GK' });
    await repo.addPlayer({ clubId: club.id, season: '26/27', number: 7, name: 'Extremo' });
    const roster = await repo.listRoster(club.id, '26/27');
    assert.deepEqual(roster.map((p) => p.number), [1, 7, 10]);
    assert.equal(roster[0].position, 'GK');
    assert.equal(roster.every((p) => p.active), true);
  });

  await check('INDEPENDENCIA DE TEMPORADAS: el mismo club tiene plantillas separadas por temporada', async () => {
    const club = await repo.createClub({ name: 'Atlético Handball' });
    await repo.ensureSeason('26/27');
    await repo.ensureSeason('27/28');
    // 26/27: el 9 es "López"
    await repo.addPlayer({ clubId: club.id, season: '26/27', number: 9, name: 'López' });
    // 27/28: el mismo dorsal 9 lo lleva otro jugador (traspaso), y hay un fichaje nuevo
    await repo.addPlayer({ clubId: club.id, season: '27/28', number: 9, name: 'García' });
    await repo.addPlayer({ clubId: club.id, season: '27/28', number: 11, name: 'Fichaje' });

    const r2627 = await repo.listRoster(club.id, '26/27');
    const r2728 = await repo.listRoster(club.id, '27/28');
    assert.equal(r2627.length, 1);
    assert.equal(r2627[0].name, 'López');
    assert.equal(r2728.length, 2);
    assert.equal(r2728.find((p) => p.number === 9)?.name, 'García'); // no se mezcla con 26/27
  });

  await check('updatePlayer cambia dorsal y da de baja (active=false)', async () => {
    const club = await repo.createClub({ name: 'CD Norte' });
    await repo.ensureSeason('26/27');
    const p = await repo.addPlayer({ clubId: club.id, season: '26/27', number: 4, name: 'Lateral' });
    const renum = await repo.updatePlayer(p.id, { number: 14 });
    assert.equal(renum?.number, 14);
    const baja = await repo.updatePlayer(p.id, { active: false });
    assert.equal(baja?.active, false);
    // sigue en la lista (baja lógica, no borrado)
    const roster = await repo.listRoster(club.id, '26/27');
    assert.equal(roster.length, 1);
    assert.equal(roster[0].active, false);
    assert.equal(roster[0].number, 14);
  });

  await check('removePlayer borra la entrada de plantilla', async () => {
    const club = await repo.createClub({ name: 'Balonmano Sur' });
    await repo.ensureSeason('26/27');
    const p = await repo.addPlayer({ clubId: club.id, season: '26/27', number: 8, name: 'Pivote' });
    await repo.removePlayer(p.id);
    assert.equal((await repo.listRoster(club.id, '26/27')).length, 0);
  });

  await check('updateClub con patch parcial NO borra los campos que no incluye (pg)', async () => {
    const club = await repo.createClub({ name: 'CB Ribera', shortName: 'RIB', color: '#33aa55' });
    const upd = await repo.updateClub(club.id, { name: 'CB Ribera Actualizado' });
    assert.equal(upd?.name, 'CB Ribera Actualizado');
    assert.equal(upd?.shortName, 'RIB'); // no se ha borrado por no venir en el patch
    assert.equal(upd?.color, '#33aa55');
  });

  await check('CATÁLOGO EN MEMORIA: updateClub y updatePlayer con patch parcial no borran el resto', async () => {
    const club = await inMemoryCatalogRepo.createClub({ name: 'CB Puente', shortName: 'PTE', color: '#112233' });
    const updClub = await inMemoryCatalogRepo.updateClub(club.id, { color: '#ffcc00' });
    assert.equal(updClub?.name, 'CB Puente'); // el nombre no venía en el patch: se conserva
    assert.equal(updClub?.shortName, 'PTE');
    assert.equal(updClub?.color, '#ffcc00');

    await inMemoryCatalogRepo.ensureSeason('26/27');
    const p = await inMemoryCatalogRepo.addPlayer({ clubId: club.id, season: '26/27', number: 6, name: 'Central', position: 'GK' });
    const updPlayer = await inMemoryCatalogRepo.updatePlayer(p.id, { active: false });
    assert.equal(updPlayer?.active, false);
    assert.equal(updPlayer?.number, 6); // no venía en el patch: se conserva
    assert.equal(updPlayer?.name, 'Central');
    assert.equal(updPlayer?.position, 'GK');
  });

  await check('FOTO: updateClub y updatePlayer persisten photoUrl (columna de la migración v5)', async () => {
    const club = await repo.createClub({ name: 'CB Foto' });
    const updClub = await repo.updateClub(club.id, { photoUrl: '/api/catalog/clubs/x/photo' });
    assert.equal(updClub?.photoUrl, '/api/catalog/clubs/x/photo');
    assert.equal((await repo.getClub(club.id))?.photoUrl, '/api/catalog/clubs/x/photo');

    await repo.ensureSeason('26/27');
    const p = await repo.addPlayer({ clubId: club.id, season: '26/27', number: 5, name: 'Foto Jugador' });
    const updPlayer = await repo.updatePlayer(p.id, { photoUrl: '/api/catalog/players/y/photo' });
    assert.equal(updPlayer?.photoUrl, '/api/catalog/players/y/photo');
    assert.equal((await repo.getPlayer(p.id))?.photoUrl, '/api/catalog/players/y/photo');

    // Borrado de foto: se guarda como '' y se distingue de "sin tocar" (undefined).
    const cleared = await repo.updateClub(club.id, { photoUrl: '' });
    assert.equal(cleared?.photoUrl, '');
  });

  await check('PERSISTENCIA: una instancia nueva del repo ve los datos ya guardados', async () => {
    // Instancia distinta sobre la misma base, SIN re-migrar (las tablas ya existen).
    // Prueba que los datos persisten más allá del objeto repositorio que los escribió.
    const repo2 = makePgCatalogRepository(pool as any);
    // La temporada 26/27 y el club Oviedo se crearon en checks anteriores.
    assert.ok((await repo2.listSeasons()).some((s) => s.code === '26/27'));
    assert.ok((await repo2.listClubs()).some((c) => c.name === 'Balonmano Oviedo'));
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
