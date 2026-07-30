# Alta en directo desde catálogo + Clips automáticos

Dos mejoras, cada una construida, testeada y verificada sobre clon limpio.

## Bloque 1 — Equipos y plantillas también en directo

Antes, el alta en directo era un formulario pelado (dos nombres) y no tocaba el catálogo:
no salían los clubes ya guardados ni se podían crear plantillas nuevas persistentes. Ahora
el alta en directo tiene los **mismos** clubes y plantillas que el de vídeo.

- Se extrae el selector de club + plantilla a un componente compartido: `web/features/matches/team-roster.tsx`
  (tipos, helpers de catálogo — `fetchClubs`, `loadRoster`, `ensureSeason`, `pickClub`, `resolveSide` — y `TeamRosterPicker`).
- `NewVideoMatch` se refactoriza para consumir ese módulo (mismo comportamiento, cero duplicación).
- `NewLiveMatch` gana dos modos:
  - **Desde catálogo** (por defecto): temporada + club existente (precarga plantilla) o nuevo.
    Al crear, club y jugadores quedan guardados y reutilizables, y el partido enlazado.
  - **Rápido**: sólo dos nombres y dorsales genéricos 1–16, para no frenar el saque inicial.
    La plantilla se afina dentro de la sala (guardarla al catálogo desde la sala será una micro-fase).
- La ruta `POST /api/matches` ya aceptaba `season`/`clubId`/`players` para ambos modos; sólo faltaba
  que el formulario de directo los enviara.
- Temporada por defecto 26/27 en ambos.

Test: nuevo check en `web/test/match-catalog-link.test.ts` — un partido **en directo** creado desde
catálogo persiste temporada y enlaces (`club_id`, `player_id`) igual que vídeo.

## Bloque 2 — El corte deja de ser manual

Antes había que marcar `IN`/`OUT` a mano y cortar; anotabas la estadística y tenías que rebobinar
para cortar. Ahora **cada acción anotada genera un clip candidato** y tú eliges cuáles descargar.

- Nueva función pura `web/lib/handball/clips.ts`:
  - `deriveClips(events, home, away, duration, window, overrides)` → clips como proyección de los
    eventos. Ventana por defecto **8 s antes / 4 s después**, recortada a `[0, duración]`.
  - Generan clip: tiros (gol, parada, fuera, blocado, incluido penalti), pérdida, recuperación,
    falta, exclusión 2′, amarilla y roja. **No**: cambio, cambio de portero, tiempo muerto ni pase a 10 m.
  - `matchesFilters` para los filtros rápidos: **Local, Visitante, Goles, Pérdidas** (dentro de cada
    dimensión suman, entre dimensiones se cruzan).
- `ClipsPanel` reescrito: lista de clips detectados con casilla de selección (**desmarcados por
  defecto**), filtros rápidos, ventana global ajustable (antes/después) y ajuste fino por clip
  (±1 s en IN/OUT, con reset). «Renderizar seleccionados (N)» renderiza sólo los marcados.
- `AnalysisRoom`: fuera `inPt/outPt/markIn/markOut/addClip` y las teclas `i`/`o`; dentro clips
  derivados (memo), selección, filtros, ventana y overrides. Borrar un evento limpia su clip.
  La preview con auto-pausa al final del clip (`clipStopRef`) se conserva.
- `VideoStage`: se quitan los botones `IN/OUT/Cortar` y el overlay de in/out; la barra de tiempo
  ahora pinta los clips **seleccionados** y muestra `tiempo / duración`.

Test: `web/test/clips.test.ts` (12 casos) — tipos que generan clip, ventana y recortes, override,
etiqueta, orden por tiempo y semántica de filtros.

## Estado de verificación

- **139 tests web** + **12 raíz** en verde.
- `tsc --noEmit -p tsconfig.json` limpio.
- `next build` compilando.
