# Handball Edge AI — Web

Plataforma web de análisis de balonmano en **Next.js (App Router) + TypeScript + Tailwind**, con
**dos modos de captura** sobre el mismo modelo:

| Modo | Ruta | Reloj | Clips | Estadística |
|---|---|---|---|---|
| **Vídeo** | `/matches/[id]/analyze` | del reproductor | sí (ffmpeg) | idéntica |
| **Directo** | `/matches/[id]/live` | reloj corrido del partido | no | idéntica |

Ambos escriben los **mismos eventos canónicos** (`match_event`) y comparten `TagPanel`,
`StatsPanel`, `EventLog` y el `recomputeAggregates` del backend. La única diferencia real es de
dónde sale el tiempo: por eso la estadística y el Play Score son los mismos, no parecidos.

Cada tiro captura **desde dónde se lanza** (8 zonas de pista → base del xG) y **dónde se coloca**
(9 zonas de portería → base del xGOT). Ver `../ZONAS_XG_XGOT.md`.

## Arranque

```bash
cd web
npm install
npm run dev          # http://localhost:3000  ->  redirige a /matches
```

Verificación:

```bash
npx tsc --noEmit        # typecheck de toda la web (componentes incluidos)
npm run build           # build de producción de Next
npm run test            # las tres suites del núcleo (no necesitan Next)
```

Suites (requieren ffmpeg en el PATH para el test de render):

| Comando | Qué prueba |
|---|---|
| `npm run test:lib` | Paridad front/back del Play Score sobre la J24 |
| `npm run test:db` | Repositorio Postgres contra `pg-mem` |
| `npm run test:live` | Modo directo: creación, persistencia y paridad estadística |
| `npm run test:zones` | Zonas de lanzamiento: agregados de xG/xGOT y persistencia |
| `npm run test:render` | Corte real de vídeo con ffmpeg |

**Comprobado de punta a punta por HTTP** (subir vídeo → etiquetar → extraer estadística →
renderizar clip → descargar `.mp4`): el clip descargado dura exactamente lo marcado y el blocaje
puntúa a su defensor.

## Mapa

```
web/
  app/
    matches/page.tsx                       Biblioteca (lista de partidos)
    matches/[matchId]/analyze/page.tsx     Sala de análisis sobre vídeo
    matches/[matchId]/live/page.tsx        Sala de anotación en directo
    api/matches/route.ts                   GET lista · POST crear partido
    api/matches/[id]/events/route.ts       GET / PUT eventos
    api/matches/[id]/stats/route.ts        POST extraer · GET leer estadística
    api/matches/[id]/video/route.ts        POST subir vídeo al servidor
    api/clips/render/route.ts              POST crear job de render
    api/clips/render/[jobId]/route.ts      GET estado del job
    api/clips/render/[jobId]/[file]/route  GET descargar .mp4
  features/
    analysis/   AnalysisRoom + Scoreboard, VideoStage, TagPanel, ClipsPanel, StatsPanel, EventLog, GoalTarget
    live/       LiveRoom + LiveClock + useMatchClock  (reutiliza TagPanel/StatsPanel/EventLog)
    matches/    repository + MatchLibrary + NewLiveMatch + types
  lib/
    theme.ts               paleta (única fuente: inline + tailwind.config)
    handball/              MODELO COMPARTIDO (mapping.ts -> recompute del backend)
    video/                 ffmpeg.ts (probe/cutClip) + render-service.ts (cola de jobs)
  test/  live-stats.test.ts (paridad)   ffmpeg-render.test.ts (corte real)
```

## Modelo compartido (sin duplicación)

`lib/handball/mapping.ts` importa **directamente** el dominio y el `recomputeAggregates` del
backend (`../../../src/ingestion/...`), *framework-free* justo para esto. El front traduce sus
eventos de UI a canónicos y llama a la misma función que la API. `test:lib` incluye un
`assert.deepEqual(liveStats, recomputeAggregates)` que **falla si hay drift**.

> Empaquetado: hoy el import cruza carpetas por ruta relativa (layout `handball-edge-ai/{src,web}`).
> El paso limpio es extraer `src/ingestion/{domain,application}` a un paquete `@handball/core`.

## Roadmap

### 1. Corte real de vídeo — IMPLEMENTADO

Flujo completo con **ffmpeg** (probado, `npm run test:render` → 9/9):

- **Subida** — al cargar el vídeo se sube al servidor (`POST /api/matches/[id]/video`, guardado en
  `.data/uploads`; se registra el `videoRef` del partido).
- **Render** — `POST /api/clips/render` crea un *job* que ejecuta `ffmpeg` por clip
  (`lib/video/ffmpeg.ts → cutClip`). Modos: `accurate` (reencode H.264/AAC, **corte frame-exacto**,
  por defecto) y `fast` (`-c copy`, rapidísimo pero alineado a keyframe).
- **Progreso y descarga** — `GET /api/clips/render/[jobId]` da el estado; cada clip terminado se
  descarga en `GET /api/clips/render/[jobId]/[file]`. La UI hace *polling*, muestra barra de progreso
  y un botón de descarga por clip.

> Producción: la cola de jobs es en memoria (`lib/video/render-service.ts`) y el disco es local.
> Sustituir por worker real (BullMQ/Redis) + almacenamiento de objetos (S3) sin tocar UI ni endpoints;
> `RenderJob`/`ClipResult` ya modelan lo necesario.

### 2. Biblioteca de partidos — IMPLEMENTADO (Postgres)

Persistencia real sobre Postgres (`lib/db`), probada con `pg-mem` (`npm run test:db` → 7/7):

- **Esquema** (`lib/db/schema.ts`): `match`, `team`, `player`, `match_event` (**capa canónica, fuente
  de verdad**) y `match_read_model` (read-models persistidos). El corte por rango sobre
  `match_event` (hypertable de TimescaleDB) va en `TIMESCALE_SQL`, aparte del esquema base.
- **Repositorio** (`lib/db/matches-repo.pg.ts`): implementa `MatchesRepository`. Guarda eventos
  canónicos y **reconstruye** los partidos desde `match_event`; `list()` recalcula el marcador con la
  función compartida; `markExtracted()` persiste los read-models en `match_read_model`.
- **Selector** (`features/matches/repository.ts → getMatchesRepo()`): usa Postgres si hay
  `DATABASE_URL`, si no la implementación en memoria (dev/demo, con seed). Las páginas y rutas ya lo
  usan; el mismo repo lo consumirá la API Nest.

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/handball   # activa Postgres
# (opcional, TimescaleDB) aplicar TIMESCALE_SQL tras crear las tablas
```

> El `pg.Pool` y el pool de `pg-mem` cumplen el mismo contrato `Queryable`, así que el **mismo código**
> corre en test (sin servidor) y en producción.

### 3. Extracción de estadística por partido — IMPLEMENTADO

`POST /api/matches/[id]/stats` recalcula los read-models canónicos y marca el partido como
*extraído*; en producción delega en `IngestMatchUseCase` del backend. La estadística en vivo de la
sala usa el mismo cálculo para feedback inmediato mientras se etiqueta. La persistencia real va con
la pieza 2.

## shadcn/ui

`globals.css` + `tailwind.config.ts` traen las variables de shadcn ya apuntando a la identidad oscura.
Cualquier primitivo (`npx shadcn@latest add button tabs dialog tooltip`) hereda el look. Los
componentes de dominio (vídeo, timeline, diana, tabla de Play Score) son a medida; los genéricos se
pueden sustituir por primitivos cuando quieras.

## Notas

- El vídeo se reproduce como `objectURL` en el cliente y, en paralelo, se sube al servidor para poder
  renderizar. Sin subida no hay render (el endpoint responde 422 pidiéndola).
- Export **NormalizedMatch** (fuente `MANUAL`) desde la cabecera: mismo contrato de frontera que
  produce la ingesta de informe → entra por el mismo caso de uso del backend.
