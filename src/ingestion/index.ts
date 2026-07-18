/**
 * @handball/core — dominio y aplicación de análisis de balonmano, framework-free.
 *
 * Punto de entrada único del núcleo compartido entre el backend (NestJS) y el frontend
 * (Next.js). Antes, `web` importaba con rutas relativas frágiles del tipo
 * `../../../src/ingestion/domain/match-event`. Ahora todo entra por `@handball/core`.
 *
 * Regla: nada de aquí depende de React, Next ni NestJS. Es TypeScript puro para que
 * `tsx` (raíz), Next.js (web) y el bundler resuelvan el mismo código sin drift.
 */

// --- Dominio ---
export {
  EventType,
  ShotOrigin,
  ShotOutcome,
} from './domain/match-event';
export type { ShotPayload, MatchEvent } from './domain/match-event';

export {
  IngestionSource,
} from './domain/normalized-match';
export type {
  TeamSide,
  NormalizedMatch,
  NormalizedTeam,
  NormalizedPlayer,
  NormalizedShot,
  NormalizedEvent,
} from './domain/normalized-match';

export { Position, normalizePosition } from './domain/position';

// --- Aplicación: Play Score ---
export {
  PLAY_SCORE_WEIGHTS,
  TERM_ORIGIN,
  computePlayScore,
} from './application/play-score';
export type { PlayScoreWeights, PlayScoreInput } from './application/play-score';

export { parseWeights, defaultWeights } from './application/play-score-config';
export type { CoefficientsFile } from './application/play-score-config';

// --- Aplicación: xG / xGOT ---
export {
  DEFAULT_XG,
  computeXg,
  sumXg,
} from './application/xg';
export type { XgCoefficients, XgInput, XgResult } from './application/xg';

// --- Aplicación: agregados y read-models ---
export { recomputeAggregates } from './application/recompute-aggregates';
export type {
  OriginCount,
  OriginBreakdown,
  TermOrigin,
  PlayScoreTerm,
  PlayScore,
  PlayerLine,
  TeamSummary,
  MatchSummary,
} from './application/read-models';

// --- Aplicación: puertos (contratos de repositorios y adaptadores) ---
export type {
  ResolvedPlayer,
  ResolvedTeam,
  ResolvedRoster,
  EntityResolver,
  MatchEventRepository,
  ReadModelRepository,
} from './application/ports/repositories';
export type { IngestionAdapter } from './application/ports/ingestion.adapter';

// --- Aplicación: caso de uso de ingesta ---
export { IngestMatchUseCase } from './application/ingest-match.use-case';
export type { IngestResult } from './application/ingest-match.use-case';

// --- Infraestructura framework-free (implementaciones sin NestJS) ---
// Nota: ingestion.module.ts NO se exporta aquí porque depende de @nestjs/common.
// El backend NestJS lo importa por su ruta directa; el core se mantiene puro.
export { ReportImportAdapter } from './infrastructure/report-import.adapter';
export type { RawReport } from './infrastructure/report-import.adapter';
export {
  InMemoryEntityResolver,
  InMemoryMatchEventRepository,
  InMemoryReadModelRepository,
} from './infrastructure/in-memory-repositories';
