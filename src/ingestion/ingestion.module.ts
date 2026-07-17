/* Cableado NestJS (ILUSTRATIVO). Excluido del typecheck/tests de esta rebanada porque
 * requiere @nestjs/common. En producción, sustituye los dobles en memoria por los repos
 * reales (match_event hypertable + read-models) sin tocar el caso de uso. */
import { Module } from '@nestjs/common';
import { IngestMatchUseCase } from './application/ingest-match.use-case';
import { EntityResolver, MatchEventRepository, ReadModelRepository } from './application/ports/repositories';
import { ReportImportAdapter } from './infrastructure/report-import.adapter';
import {
  InMemoryEntityResolver, InMemoryMatchEventRepository, InMemoryReadModelRepository,
} from './infrastructure/in-memory-repositories';

// Tokens de inyección para los puertos.
export const ENTITY_RESOLVER = Symbol('EntityResolver');
export const MATCH_EVENT_REPOSITORY = Symbol('MatchEventRepository');
export const READ_MODEL_REPOSITORY = Symbol('ReadModelRepository');

@Module({
  providers: [
    ReportImportAdapter,
    { provide: ENTITY_RESOLVER, useClass: InMemoryEntityResolver },
    { provide: MATCH_EVENT_REPOSITORY, useClass: InMemoryMatchEventRepository },
    { provide: READ_MODEL_REPOSITORY, useClass: InMemoryReadModelRepository },
    {
      provide: IngestMatchUseCase,
      inject: [ENTITY_RESOLVER, MATCH_EVENT_REPOSITORY, READ_MODEL_REPOSITORY],
      useFactory: (r: EntityResolver, e: MatchEventRepository, rm: ReadModelRepository) =>
        new IngestMatchUseCase(r, e, rm),
    },
  ],
  exports: [IngestMatchUseCase, ReportImportAdapter],
})
export class IngestionModule {}
