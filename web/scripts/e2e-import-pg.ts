/** E2E: informe J24 → adaptador → puente → repo seleccionado por DATABASE_URL (Postgres real). */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ReportImportAdapter } from '@handball/core';

// Si DATABASE_URL no está en el entorno, buscarla en web/.env.local (igual que Next).
if (!process.env.DATABASE_URL && existsSync(join(process.cwd(), '.env.local'))) {
  for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
    if (m) { process.env.DATABASE_URL = m[1]; break; }
  }
}
import { normalizedToWeb } from '../lib/handball/ingest-bridge';
import { getMatchesRepo } from '../features/matches/repository';

async function main() {
  const raw = JSON.parse(readFileSync('test/j24-report.sample.json', 'utf8'));
  const normalized = new ReportImportAdapter().toNormalizedMatch(raw);
  const { create, events } = normalizedToWeb(normalized);

  const repo = await getMatchesRepo();
  const match = await repo.create(create);
  await repo.saveEvents(match.matchId, events);

  const list = await repo.list();
  const item = list.find((m) => m.matchId === match.matchId)!;
  console.log(`Partido: ${item.homeName} ${item.homeGoals}-${item.awayGoals} ${item.awayName} · ${item.eventCount} eventos · modo ${item.mode}`);
  if (item.homeGoals !== 6 || item.awayGoals !== 4) { console.error('✗ marcador NO coincide con el backend'); process.exit(1); }
  console.log('✓ marcador 6-4 coincide con el que valida el backend (sin drift, sobre Postgres real)');
}
main().catch((e) => { console.error(e); process.exit(1); });
