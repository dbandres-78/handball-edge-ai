# Ola: equipos y jugadores persistentes — Fase A (catálogo)

Estado: **completada y verificada** (109 tests web en verde, typecheck limpio, build de Next OK).

## Idea que gobierna toda la ola

La capa canónica de eventos (`match_event`) **no se toca**. Los eventos siguen
refiriéndose al jugador por `side:dorsal` dentro de cada partido. La identidad persistente
vive en un **catálogo** aparte, y la **plantilla de cada partido será el puente** entre "el
dorsal N en este partido" y "la identidad del catálogo". La estadística acumulada (Fase C)
es una **proyección** sobre `match_event` usando ese puente — coherente con "los
read-models son proyecciones", sin duplicar ni arriesgar la fuente de verdad.

## Decisiones cerradas

1. La temporada es una **dimensión de primer nivel**; temporadas independientes (bucket
   propio). Temporada actual: **26/27**.
2. El **club persiste** entre temporadas; la **plantilla es por temporada** (un jugador
   pertenece a un club en una temporada, con su dorsal de esa temporada). Vincular a la
   misma persona entre temporadas = refinamiento futuro.
3. Eventos intactos; la plantilla es el puente.
4. Acumulación **bajo demanda** (recomputar al abrir la ficha), no read-models de temporada.
5. Play Score acumulado: **total y media por partido** (dentro de la temporada).

## Qué entra en Fase A (esta entrega)

- **Esquema** (`web/lib/db/schema.ts`): tres tablas nuevas — `season`, `club`,
  `roster_player`. Se crean solas vía `migrate()` (CREATE TABLE IF NOT EXISTS), tanto en
  instalaciones nuevas como existentes, sin tocar datos.
- **Dominio** (`web/features/catalog/types.ts`): `Season`, `Club`, `RosterPlayer` + inputs.
- **Repositorio** (`web/features/catalog/repository.ts` + `web/lib/db/catalog-repo.pg.ts`):
  interfaz `CatalogRepository`, implementación en memoria (dev sin `DATABASE_URL`) e
  implementación Postgres, con el selector `getCatalogRepo()`. CRUD de temporadas, clubes y
  plantillas.
- **Tests** (`web/test/catalog.test.ts`, script `test:catalog`): 9 comprobaciones con
  pg-mem, incluidas **independencia entre temporadas** y **persistencia** entre instancias.

No hay UI en esta fase (deliberado).

## Verificar en tu máquina

Desde `web`:

```
npm test              # la batería completa, ahora con test:catalog
npm run verify:pg     # 16/16 contra tu Postgres real (usa handball_verify)
```

## Siguiente: Fase B — botón "Nuevo partido de vídeo" + alta/selección de plantillas

- Columnas de enlace en el esquema, con su migración incremental (ALTER TABLE ADD COLUMN
  IF NOT EXISTS) y **junto al código que las escribe**: `season` en `match`, `club_id` en
  `team`, `player_id` en `player`.
- Componente `NewVideoMatch` en la biblioteca (hermano de `NewLiveMatch`/`ImportReport`):
  elegir temporada (por defecto 26/27), club local y visitante desde el catálogo, marcar
  quién juega + titulares + portero; crear el partido enlazado al catálogo.

## Después: Fase C — fichas y acumulación

- Ficha de jugador y ficha de equipo como proyecciones multi-partido por temporada.
- Tests: un jugador en 2 partidos suma bien; si cambia de dorsal entre partidos sigue
  agregando; conservación.
