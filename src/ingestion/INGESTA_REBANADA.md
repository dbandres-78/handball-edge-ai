# Rebanada vertical: ingesta de informe → read-models

Primera cadena de punta a punta del sistema, con el camino feliz de **un informe**:

```
informe crudo ──[ReportImportAdapter]──▶ NormalizedMatch ──[IngestMatchUseCase]──▶ match_event ──[recomputeAggregates]──▶ summary + players
                     (frontera)              (contrato)         (resolución +          (capa canónica)     (proyección pura)
                                                                  eventos canónicos)
```

Corre **sin Postgres/TimescaleDB**: los puertos tienen dobles en memoria. `npm test` ⇒ 7/7 verde.

## La regla de frontera (lo que de verdad valida esta rebanada)

Todo lo específico del formato Handball.AI vive **dentro del adaptador** y **no cruza** a `NormalizedMatch`:

| Peculiaridad del informe            | Contenida en                    | Resultado canónico |
|-------------------------------------|---------------------------------|--------------------|
| Verbos ES ("Gol", "Tiro parado"…)   | `ACTION_MAP` (report adapter)   | `EventType` + `ShotOutcome` |
| Puestos ES ("LI", "PIV"…)           | `normalizePosition` (domain)    | `Position` (GK/LB/…/LP) |
| Alias de patrocinador               | `SPONSOR_ALIASES` (report adapter) | nombre canónico del club |
| Reloj "MM:SS", parte 1/2            | `clockToMs` (use case)          | `ts` ISO + `gameClockMs` |

Consecuencia: el próximo adaptador (etiquetado manual, CV) sólo tiene que producir el mismo
`NormalizedMatch` y **reutiliza el caso de uso, la capa de eventos y los agregados sin tocarlos**.

## Play Score auditable

`computePlayScore` usa los 4 pesos reconstruidos en Ola 3 (gol +1.8, fallo −1.0, pérdida −0.55,
parada +1.84) y devuelve el **desglose término a término**. Los términos defensivos (≈50% del
impacto, no exportable del informe) se **registran pero aún no puntúan** — pendientes del modelo
propio sobre la capa de eventos.

## Dónde está la resolución de identidades

`EntityResolver` (puerto) hace el get-or-create de equipos/jugadores: "cargar equipos nuevos o
reutilizar los ya cargados". El `NormalizedMatch` referencia por **dorsal**, nunca por id interno;
la resolución a ids ocurre en el caso de uso, no en el adaptador.

## Mapeo `MatchEvent` → tabla `match_event` (hypertable)

| Campo TS      | Columna sugerida        | Nota |
|---------------|-------------------------|------|
| `ts`          | `time timestamptz`      | dimensión temporal del hypertable (`playedAt` + reloj) |
| `matchId`     | `match_id`              | partition/índice |
| `seq`         | `seq int`               | orden estable intra-partido |
| `teamId`      | `team_id`               | |
| `playerId`    | `player_id` (nullable)  | null en eventos de equipo |
| `type`        | `type` (enum)           | |
| `payload`     | `payload jsonb`         | `ShotPayload` para SHOT |
| `gameClockMs` | `game_clock_ms int`     | |
| `period`      | `period smallint`       | |

`replaceForMatch` = ingesta idempotente (borra e inserta los eventos del partido en una transacción).

## Para pasar a real

1. Implementa `MatchEventRepository` / `ReadModelRepository` / `EntityResolver` sobre Postgres+Timescale.
2. Sustituye los `useClass` en `ingestion.module.ts`. **El caso de uso no cambia.**
3. Cambia el fixture sintético por el export real de la J24.

## Ejecutar

```bash
npm i           # typescript, tsx, @types/node
npm run typecheck
npm test
```
