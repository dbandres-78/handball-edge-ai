# Fase B1 — Fontanería del "Nuevo partido de vídeo" (backend)

Estado: **completada y verificada** (116 tests web en verde, typecheck limpio, build OK).
Es la base sin UI. El botón y el formulario llegan en **B2**.

## Qué entra

- **Columnas de enlace al catálogo** (esquema base + migración incremental v3 con
  `ALTER TABLE ADD COLUMN IF NOT EXISTS`, protegiendo datos existentes):
  `season` en `match`, `club_id` en `team`, `player_id` en `player`.
- **`create()` extendido** (memoria y Postgres) para aceptar y persistir `season` y los
  enlaces (`clubId` por equipo, `playerId` por jugador). Round-trip verificado.
- **`saveRoster` preserva los enlaces**: el autosave de la sala (que no conoce el catálogo)
  ya NO borra `club_id`/`player_id`. Helper `mergeTeamLinks`, con test dedicado.
- **Rutas de API del catálogo** (nuevas):
  - `GET/POST /api/catalog/seasons`
  - `GET/POST /api/catalog/clubs`
  - `GET/POST /api/catalog/clubs/[clubId]/roster?season=`
  - `PATCH/DELETE /api/catalog/players/[playerId]`

## Verificar en tu máquina

Desde `web`: `npm test` (incluye `test:catlink`) y `npm run verify:pg`.

## Siguiente: B2 — el botón y el formulario

- Componente `NewVideoMatch` en la cabecera de la biblioteca (junto a Importar informe /
  Anotar en directo).
- Formulario: temporada (26/27 por defecto) → por lado, elegir club del catálogo
  (precarga su plantilla de esa temporada) o crear uno nuevo y escribir su plantilla →
  crear partido de vídeo enlazado al catálogo → ir a la sala de análisis.
- Reutiliza las rutas de API de B1. El afinado fino de alineación sigue en la sala.
