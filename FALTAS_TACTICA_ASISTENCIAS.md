# Faltas provocadas/cometidas, "acción individual", asistencias y motivo de la pérdida

Cuatro ampliaciones de captura pedidas antes de retomar los informes en PDF (18/09/2026), a raíz
de cruzar los informes de referencia de handball.ai (y el propio informe AP STATS original) con
nuestro modelo de datos (ver `claude/hacia_el_informe_ideal.md`, sección 7 del documento del
proyecto). Las cuatro viven en el `payload` JSONB del evento canónico: **no hace falta migración
de base de datos**, igual que el resto de campos opcionales de esta familia (`blockerId`,
`goalkeeperId`, `tacticalContext`).

## 1. Faltas: cometida vs. provocada

- `src/ingestion/domain/match-event.ts` — nueva interfaz `FoulPayload` con `drawnById?`
  (opcional): el jugador RIVAL que sufre/provoca la falta. El jugador del propio evento
  (`playerId`) sigue siendo quien la comete, como hasta ahora.
- `recompute-aggregates.ts` — nuevo campo `foulsDrawn` en `PlayerLine` (junto al ya existente
  `fouls`, que pasa a leerse claramente como "cometidas"). Si `drawnById` coincide con el mismo
  equipo que comete (dato inconsistente) o no resuelve a nadie del roster, no se atribuye —
  igual criterio que ya usa el blocaje sin `blockerId`.
- `TagPanel.tsx` — nuevo bloque "¿A quién se la hace?" con los jugadores del rival, opcional,
  visible junto al resto de atributos de tiro (aplica solo a «Falta»). Se resetea tras anotar.

## 2. "Acción individual" como combinación táctica explícita

- `TacticalContext` gana un quinto valor, `ACCION_INDIVIDUAL`: a diferencia de "Omitir" (que deja
  la jugada sin clasificar), esta es una clasificación EXPLÍCITA de que no hubo combinación y el
  atacante resolvió por sí solo. Con esto la tabla de "Sistema de partido" puede ser exhaustiva
  cuando el analista quiere clasificar siempre, sin forzar a inventarse una combinación que no
  hubo. Permuta/Cruce/Desdoblamiento/Cortina se mantienen tal cual (no se ha tocado su
  significado ni se ha quitado ninguna).
- El modal de clasificación (`TacticalContextModal.tsx`) no necesitó cambios: renderiza
  `TACTICAL_CONTEXTS` dinámicamente, así que el quinto botón aparece solo.
- **Agregación nueva** (antes solo se capturaba, no se resumía en ningún sitio): `TeamSummary`
  gana `tacticalContext: TacticalBreakdown`, un desglose por combinación (veces jugada, goles,
  paradas, palo/fuera, 7 metros — la base directa de la tabla "Sistema De Partido" del informe de
  referencia). Se agrega igual que `byOrigin`, tanto para tiros como para pérdidas (una pérdida
  cuenta como "veces jugada" pero no tiene desenlace de gol/parada).

## 3. Asistencias

- `ShotPayload` gana `assisterId?`: el compañero cuyo pase precede el gol. Solo se atribuye
  cuando el desenlace es GOAL y el asistente es del mismo equipo que anota (si no, se ignora,
  mismo criterio que el resto de atribuciones opcionales).
- `PlayerLine` gana `assists: number`.
- `TagPanel.tsx` — nuevo bloque "¿Quién asiste?" con los compañeros del jugador seleccionado
  (excluyéndolo a él), opcional, aplica solo a «Gol». Se resetea tras anotar un tiro.

## 4. Motivo de la pérdida

- `src/ingestion/domain/match-event.ts` — nuevo enum `TurnoverReason` (`FALTA_EN_ATAQUE`,
  `ROBO_DE_PASE`, `RECEPCION`, `PISANDO_AREA`, `DOBLES`, `PASOS`), añadido como campo opcional
  `reason?` en `TurnoverPayload`. Son las mismas categorías que ya desglosaba el informe AP
  STATS original (sección 1, punto 11 de `claude/hacia_el_informe_ideal.md`), que hasta ahora
  no se capturaban en ningún evento propio: se sabía que hubo pérdida, pero no por qué.
- `recompute-aggregates.ts` — nuevo campo `turnoversByReason: TurnoverBreakdown` en
  `TeamSummary` (a nivel de equipo, igual que `tacticalContext`): cuenta cuántas pérdidas de
  cada motivo tuvo el equipo. Sin motivo anotado, la pérdida sigue contando en el total pero no
  entra en este desglose (paso opcional y saltable, mismo criterio que el resto).
- `TagPanel.tsx` — nuevo bloque "Motivo de la pérdida" con los 6 motivos, opcional, aplica solo
  a «Pérdida». Se resetea tras anotar.

## Dónde se enchufó cada pieza

`LiveRoom.tsx` y `AnalysisRoom.tsx` (directo y vídeo) llevan el mismo patrón: nuevo estado
(`assister`, `drawnBy`, `turnoverReason`), se pasan a `TagPanel` y se vuelcan en el `UiEvent` que
construye `tag()` según el desenlace/tipo de acción. `lib/handball/mapping.ts`
(`toCanonicalEvents`) traduce esos campos de UI a los payloads canónicos (`assisterId`,
`drawnById`, `reason`) — los dos primeros con el mismo formato `lado:dorsal` que ya usan
`blockerId`/`goalkeeperId`.

## Pendiente (fuera de esta entrega — el usuario decidió no añadirlo)

- **"1 contra 1" (ganado/perdido)**: no existe ningún tipo de evento para esto hoy; haría falta
  un `EventType` nuevo. Valorado y descartado por ahora (18/09/2026).

## Verificación

- `npx tsc --noEmit` (raíz) — limpio.
- `npm test` (raíz, `test/ingest-match.slice.test.ts`) — 12/12.
- `npm run build` (web, `next build`) — compila y genera todas las rutas.
- `npm test` (web, 30 ficheros) — todos en verde, incluido
  `test/tactical-assists-fouls.test.ts` (8 casos: asistencia atribuida/ignorada por equipo/por
  desenlace, falta cometida/provocada/ignorada por equipo, agregación táctica por equipo,
  agregación de motivo de pérdida por equipo).
