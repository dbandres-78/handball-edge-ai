# Directo rediseñado, contexto táctico, alta de clubes sin partido y fotos

Cuatro mejoras pedidas en el mismo bloque, implementadas en orden: (1) rediseño de la vista en
directo para dar protagonismo a la zona de lanzamiento y la portería, (2) paso opcional de
clasificación táctica antes de cerrar una acción, (3) alta de club + plantilla sin necesidad de
crear un partido, y (4) foto de club y de jugador para informes más visuales.

## 1. Directo: reloj compacto y más espacio para zona/portería/plantilla

- `features/live/LiveClock.tsx` — nuevo prop `compact`: en modo compacto renderiza
  `LiveClockBar` (marcador + reloj + controles + partes, todo en una fila) en vez del bloque
  vertical grande. El bloque original se mantiene intacto para quien lo use sin `compact`.
- `features/analysis/TagPanel.tsx` — nuevo prop `layout?: 'stack' | 'wide'` (por defecto
  `'stack'`, que es el comportamiento de siempre, usado por `AnalysisRoom` en su sidebar
  estrecho de 480px sin ningún cambio). En `'wide'` renderiza una rejilla de 3 columnas
  (plantilla | zona de lanzamiento y portería, más grandes | acciones) y agrupa jugadores en
  **EN CAMPO** / **BANQUILLO**.
- `features/live/LiveRoom.tsx` — cabecera con el switch Anotar/Estadística junto a
  Guardar/Exportar/Finalizar; `LiveClock compact` justo debajo; `NearPassBar` en su franja
  propia; contenido a ancho completo con `TagPanel layout="wide"` (o `StatsPanel`). Un solo
  compromiso: nada del reloj "roba" media pantalla en cada corte.

## 2. Paso opcional: clasificación táctica de la jugada

- `src/ingestion/domain/match-event.ts` — nuevo enum `TacticalContext`
  (`PERMUTA | CRUCE | DESDOBLAMIENTO | CORTINA`), añadido como campo opcional
  `tacticalContext?` en `ShotPayload` y `TurnoverPayload`. Al vivir en el `payload` JSONB del
  evento canónico, **no hace falta migración de base de datos**.
- `lib/handball/mapping.ts` / `lib/handball/actions.ts` — `UiEvent` lleva `tacticalContext`
  opcional; `TACTICAL_CONTEXTS` y sus etiquetas para la UI.
- `features/analysis/TacticalContextModal.tsx` (nuevo) — pantalla de 2×2 con las 4
  combinaciones + botón destacado "Omitir · anotar sin clasificar" (autofocado) + Esc = omitir.
  Solo aparece al cerrar un tiro o una pérdida (acciones terminales); el resto de acciones
  (faltas, tarjetas, tiempos muertos, cambio de portero) se anotan igual de rápido que siempre.
- `TagPanel` gestiona el `pendingAction`: si es terminal, abre el modal antes de tagear; si no,
  tagea al instante.

## 3. Clubes: crear equipo y plantilla sin partido

- `features/catalog/CreateClubForm.tsx` (nuevo) — formulario en `/clubes` para dar de alta un
  club (nombre, siglas, color) sin pasar por el alta de partido; al crear, navega a la ficha del
  club.
- `features/catalog/ClubRosterManager.tsx` (nuevo) — pestaña **Plantilla** en la ficha del club,
  independiente de los partidos jugados: usa las temporadas **globales** del catálogo
  (`/api/catalog/seasons`, no las derivadas de partidos, que en un club nuevo están siempre
  vacías) y los mismos endpoints de plantilla que ya usaba el alta de partido. Alta, edición
  (dorsal, nombre, portero, alta/baja) y borrado de jugadores por temporada.
- `features/catalog/ClubProjectionView.tsx` — pestañas **Fichas** / **Plantilla**; un club sin
  partidos abre directamente en Plantilla (Fichas estaría vacía y no serviría de nada todavía).
- **Corrección de fondo** (necesaria para que la edición en línea de Plantilla no perdiera
  datos): `PATCH /api/catalog/players/[playerId]` construía siempre un objeto con las 4 claves
  presentes (`number, name, position, active`), aunque solo viniera una en el body. Como
  `updateClub`/`updatePlayer` en memoria fusionaban con `{...actual, ...patch}` (spread plano),
  un PATCH parcial (p.ej. solo `active`) **borraba** el resto de campos poniéndolos a
  `undefined`. Nadie lo había disparado hasta ahora porque no existía UI que llamara a ese PATCH.
  Arreglado en tres sitios: la ruta (solo incluye las claves realmente presentes en el body) y
  `updateClub`/`updatePlayer` en memoria y en Postgres (fusión campo a campo con `??`, igual que
  ya hacía `toRow` para `updatePlayer` en Postgres).

## 4. Foto de club y de jugador

- `club.photo_url` / `roster_player.photo_url` — migración v5 (`lib/db/migrate.ts`) +
  columnas añadidas también al `CREATE TABLE` base (`lib/db/schema.ts`) para instalaciones
  nuevas, mismo criterio que `person_id` en la migración v4.
- `lib/photos.ts` (nuevo) — guarda/lee la imagen en disco bajo `.data/uploads/photos/{clubs|players}/{id}.{ext}`
  (mismo criterio que el vídeo de partido: local, gitignored). Al ser imágenes pequeñas, sin
  streaming: se leen/escriben enteras. `photoUrl` guardado en el catálogo es la ruta de
  **servido** (`/api/catalog/clubs/{id}/photo`), no la ruta de disco; el GET prueba las
  extensiones admitidas (jpg/jpeg/png/webp/gif) para encontrar el fichero.
- `POST|GET|DELETE /api/catalog/clubs/[clubId]/photo` y
  `POST|GET|DELETE /api/catalog/players/[playerId]/photo` (nuevas).
- `features/catalog/PhotoUploader.tsx` (nuevo) — miniatura + botón de cámara superpuesto, sube
  al elegir el fichero. Usado en la cabecera de la ficha de club, en cada fila de
  `ClubRosterManager` (plantilla) y mostrado (solo lectura) en `ClubsGrid` y en las fichas de
  jugador de la pestaña Fichas — ya visible donde antes solo había iniciales/escudo genérico.

## Verificación

- Regresión añadida en `test/catalog.test.ts`: patch parcial no borra el resto de campos
  (memoria y Postgres) + persistencia de `photoUrl` a través de la migración v5.
- **174 tests web** + **12 raíz** en verde · `tsc` limpio (raíz) · `next build` compilando sin
  avisos, build en limpio (`.next` borrado antes de compilar).
