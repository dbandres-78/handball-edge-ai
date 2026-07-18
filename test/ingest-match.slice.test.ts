import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ReportImportAdapter, RawReport,
  IngestMatchUseCase,
  recomputeAggregates,
  InMemoryEntityResolver, InMemoryMatchEventRepository, InMemoryReadModelRepository,
  PlayerLine,
  computePlayScore,
  parseWeights,
} from '@handball/core';
import coefficients from '../src/ingestion/application/playscore_coefficients.json';

const raw = JSON.parse(
  readFileSync(new URL('./fixtures/j24-report.sample.json', import.meta.url), 'utf8'),
) as RawReport;

type Fn = () => void | Promise<void>;
const tests: Array<[string, Fn]> = [];
const test = (name: string, fn: Fn) => tests.push([name, fn]);

const player = (players: PlayerLine[], side: string, number: number): PlayerLine => {
  const p = players.find(x => x.side === side && x.number === number);
  if (!p) throw new Error(`No existe el jugador ${side} #${number}`);
  return p;
};

// Contexto: adaptador + caso de uso con dobles en memoria compartidos.
function setup() {
  const resolver = new InMemoryEntityResolver();
  const eventsRepo = new InMemoryMatchEventRepository();
  const readModels = new InMemoryReadModelRepository();
  const useCase = new IngestMatchUseCase(resolver, eventsRepo, readModels);
  const adapter = new ReportImportAdapter();
  return { resolver, eventsRepo, readModels, useCase, adapter };
}

test('el adaptador contiene las peculiaridades del informe (alias, posiciones ES, verbos ES)', () => {
  const nm = new ReportImportAdapter().toNormalizedMatch(raw);
  assert.equal(nm.teams[0].name, 'BM Ejemplo');                                     // alias de patrocinador resuelto
  assert.equal(nm.teams[0].players.find(p => p.number === 7)!.position, 'LB');       // LI -> LB
  assert.equal(nm.teams[1].players.find(p => p.number === 6)!.position, 'LP');       // PIV -> LP
  assert.equal(nm.events.length, 20);
  assert.equal(nm.source, 'REPORT');
});

test('la ingesta recompone el marcador desde los eventos canónicos', async () => {
  const { useCase, adapter, readModels } = setup();
  const res = await useCase.execute(adapter.toNormalizedMatch(raw));
  assert.equal(res.eventCount, 20);
  const s = (await readModels.getSummary(res.matchId))!;
  assert.equal(s.home.goals, 6);
  assert.equal(s.away.goals, 4);
  assert.equal(s.home.shots, 7);
  assert.equal(s.away.shots, 7);
});

test('estadísticas de equipo: paradas, save%, exclusiones, tarjetas, tiempos muertos', async () => {
  const { useCase, adapter, readModels } = setup();
  const res = await useCase.execute(adapter.toNormalizedMatch(raw));
  const s = (await readModels.getSummary(res.matchId))!;
  assert.equal(s.home.saves, 3);
  assert.equal(s.home.savePct, 0.4286);        // 3 / (3 paradas + 4 goles encajados)
  assert.equal(s.away.saves, 0);
  assert.equal(s.home.timeouts, 1);
  assert.equal(s.home.yellowCards, 1);
  assert.equal(s.away.twoMinutes, 1);
  assert.equal(s.away.steals, 1);
});

test('Play Score reconstruido y auditable por jugador', async () => {
  const { useCase, adapter, readModels } = setup();
  const res = await useCase.execute(adapter.toNormalizedMatch(raw));
  const players = await readModels.getPlayers(res.matchId);

  const gk = player(players, 'HOME', 1);
  assert.equal(gk.saves, 3);
  assert.equal(gk.playScore.total, 5.52);      // 3 × 1.84
  const saveTerm = gk.playScore.breakdown.find(t => t.term === 'save')!;
  assert.deepEqual(saveTerm, { term: 'save', count: 3, weight: 1.84, contribution: 5.52, origin: 'fitted' });

  const lb = player(players, 'HOME', 7);
  assert.equal(lb.goals, 2);
  assert.equal(lb.turnovers, 1);
  assert.equal(lb.playScore.total, 3.05);      // 2×1.8 − 1×0.55

  const rw = player(players, 'AWAY', 11);
  assert.equal(rw.goals, 2);
  assert.equal(rw.misses, 2);
  assert.equal(rw.playScore.total, 1.6);       // 2×1.8 − 2×1.0
});

test('los términos defensivos ya puntúan, con su origen marcado como prior', async () => {
  const { useCase, adapter, readModels } = setup();
  const res = await useCase.execute(adapter.toNormalizedMatch(raw));
  const players = await readModels.getPlayers(res.matchId);

  const cb = player(players, 'AWAY', 8);
  assert.equal(cb.goals, 1);
  assert.equal(cb.steals, 1);
  assert.equal(cb.playScore.total, 3.2);       // 1×1.8 (fitted) + 1×1.4 (prior)

  // El desglose separa lo ajustado por regresión de los priors defensivos.
  assert.equal(cb.playScore.fittedTotal, 1.8);
  assert.equal(cb.playScore.priorTotal, 1.4);
  const steal = cb.playScore.breakdown.find(t => t.term === 'steal')!;
  assert.deepEqual(steal, { term: 'steal', count: 1, weight: 1.4, contribution: 1.4, origin: 'prior' });
});

test('la exclusión de 2 minutos penaliza a quien la comete', async () => {
  const { useCase, adapter, readModels } = setup();
  const res = await useCase.execute(adapter.toNormalizedMatch(raw));
  const players = await readModels.getPlayers(res.matchId);
  const p = player(players, 'AWAY', 6);
  assert.equal(p.twoMinutes, 1);
  assert.equal(p.playScore.total, -1.2);
  assert.equal(p.playScore.fittedTotal, 0);
  assert.equal(p.playScore.priorTotal, -1.2);
});

test('la amarilla no puntúa: es un aviso sin coste directo en juego', async () => {
  const { useCase, adapter, readModels } = setup();
  const res = await useCase.execute(adapter.toNormalizedMatch(raw));
  const players = await readModels.getPlayers(res.matchId);
  const lb = player(players, 'HOME', 7);
  assert.equal(lb.yellowCards, 1);
  assert.ok(!lb.playScore.breakdown.some(t => t.term === 'yellow'));
  assert.equal(lb.playScore.total, 3.05);      // igual que sin la amarilla
});

test('los read-models son proyección: recomputar desde match_event da lo mismo', async () => {
  const { useCase, adapter, resolver, eventsRepo, readModels } = setup();
  const nm = adapter.toNormalizedMatch(raw);
  const res = await useCase.execute(nm);

  const storedEvents = await eventsRepo.findByMatch(res.matchId);
  const roster = await resolver.resolve(nm);   // resolución determinista, reutiliza identidades
  const recomputed = recomputeAggregates(
    { matchId: res.matchId, playedAt: nm.playedAt, competition: nm.competition, matchday: nm.matchday },
    storedEvents,
    roster,
  );
  assert.deepEqual(recomputed.summary, await readModels.getSummary(res.matchId));
  assert.deepEqual(recomputed.players, await readModels.getPlayers(res.matchId));
});

test('la ingesta es idempotente: reejecutar no duplica', async () => {
  const { useCase, adapter, readModels } = setup();
  const nm = adapter.toNormalizedMatch(raw);
  const first = await useCase.execute(nm);
  const firstSummary = await readModels.getSummary(first.matchId);
  const second = await useCase.execute(nm);
  const secondSummary = await readModels.getSummary(second.matchId);
  assert.equal(second.eventCount, 20);
  assert.deepEqual(secondSummary, firstSummary);
});

(async () => {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  \u2713 ${name}`); pass++; }
    catch (e) { console.log(`  \u2717 ${name}`); console.log(`      ${(e as Error).message}`); fail++; }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

test('los coeficientes del club se cargan y coinciden con los pesos por defecto', () => {
  const w = parseWeights(coefficients);
  assert.equal(w.goal, 1.8);
  assert.equal(w.save, 1.84);
  assert.equal(w.steal, 1.4);
  assert.equal(w.twoMinutes, -1.2);
});

test('un fichero de coeficientes incompleto falla de forma ruidosa', () => {
  assert.throws(() => parseWeights({ weights: { goal: 1.8 } }), /falta o no es un número/);
  assert.throws(() => parseWeights({}), /falta el objeto "weights"/);
});

test('los pesos son inyectables por club sin tocar el código', () => {
  const custom = { ...parseWeights(coefficients), steal: 2.5 };
  const ps = computePlayScore({ goals: 0, misses: 0, turnovers: 0, saves: 0, steals: 2 }, custom);
  assert.equal(ps.total, 5);            // 2 × 2.5, en vez de 2 × 1.4
  assert.equal(ps.priorTotal, 5);
});
