# Fase C3 — Carrera del jugador entre clubes + minutos

## C3a · Identidad global de jugador

- **Migración v4:** `person_id` en `roster_player` (no destructiva; backfill = cada jugador es su
  propia persona).
- **Auto-vínculo** dentro del mismo club entre temporadas por dorsal+nombre (normalizado): no hay
  que revincular cada año. Distinto club NO se auto-vincula.
- **Vinculación manual** desde la ficha del jugador ("Vincular jugador"): eliges al mismo jugador en
  otro club/temporada y pasan a compartir carrera (`mergePersons` une todo el grupo de identidad).
  Reversible re-vinculando.
- Repo (pg + memoria): `getPlayer`, `listAllRoster` (con nombre de club), `listByPerson`,
  `mergePersons`. Rutas `GET /api/catalog/players` y `POST /api/catalog/players/[playerId]/link`.
- Test `player-identity.test.ts` (identidad por defecto, auto-vínculo, no cruza de club, merge, listado).

## C3b · Minutos + carrera

- **Minutos jugados** (núcleo): integral del tiempo en pista por jugador, desde titulares + cambios
  y cambio de portero; fin de partido = última acción registrada. Exclusiones de 2′ y expulsiones no
  se descuentan en esta versión. Aparece en la ficha de club y en la carrera. Test `minutes.test.ts`.
- **Carrera** (`buildPlayerCareer`): agrega TODOS los partidos de todas las pertenencias de la
  persona (todos sus clubes/temporadas) → totales + desglose por temporada/club, con Play Score,
  minutos, ±, goles, %acierto, pérdidas, recuperaciones, xG y las cuatro eficacias con él en pista.
  Ruta `GET /api/catalog/persons/[personId]/career`, vista en `/players/[personId]` (enlace
  "Ver carrera" desde la ficha del club). Test `career.test.ts`.

Nota v1: la ficha se accede por club; la carrera cruza clubes por `person_id` una vez vinculado.

## Verificación

- **169 tests web** + **12 raíz** en verde · `tsc` limpio (web y raíz) · `next build` compilando.
