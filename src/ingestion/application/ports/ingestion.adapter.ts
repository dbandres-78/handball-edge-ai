import { IngestionSource, NormalizedMatch } from '../../domain/normalized-match';

/**
 * Puerto de ingesta. Cada fuente (informe, etiquetado, CV) implementa esta interfaz y
 * DEBE devolver un NormalizedMatch limpio: ninguna peculiaridad del formato de origen
 * puede filtrarse más allá de aquí.
 *
 * NOTA: reconciliar con el ingestion.port.ts existente (Ola 2). Si ya declara
 * `toNormalizedMatch`, elimina esta copia e implementa aquella.
 */
export interface IngestionAdapter<TRaw = unknown> {
  readonly source: IngestionSource;
  toNormalizedMatch(raw: TRaw): NormalizedMatch;
}
