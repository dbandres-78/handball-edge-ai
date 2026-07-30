# Guardar plantillas en el catálogo desde la sala

Micro-fase que cierra el arco del «empezar rápido» del Bloque 1: si empezaste un partido en modo
Rápido (dorsales genéricos) o editaste la plantilla dentro de la sala, ahora puedes volcar esos
clubes y jugadores al catálogo (reutilizables) y enlazar el partido, sin salir de la sala.

## Servidor

- `features/catalog/promote.ts` — `promoteMatchToCatalog(matchesRepo, catalogRepo, matchId, season)`:
  asegura la temporada; por lado, usa el `clubId` si ya lo tiene o crea un club con el nombre del
  equipo; por jugador sin `playerId`, lo enlaza al `roster_player` del **mismo dorsal** en esa
  temporada si existe o lo da de alta; escribe los enlaces vía `saveRoster` (mergeTeamLinks) y fija
  `match.season`. **Idempotente**: repetir no duplica. Los jugadores ya enlazados no se tocan.
- `MatchesRepository.setSeason(matchId, season)` — nuevo método (interfaz + Postgres + memoria);
  antes no había forma de fijar la temporada tras crear el partido.
- `POST /api/matches/[matchId]/catalog` con `{ season }` → devuelve los equipos ya enlazados.

## Cliente

- Botón «Guardar plantillas en el catálogo» dentro del panel de plantilla (`TagPanel`, al desplegar
  «Plantillas»), visible en las dos salas (vídeo y directo). Modal breve con la temporada
  (por defecto `match.season ?? '26/27'`); al confirmar, la sala actualiza `home`/`away` con los
  enlaces devueltos para que el autosave los conserve.

## Decisiones aplicadas

- Guarda **ambos** equipos y enlaza el partido.
- Reutiliza jugador por **dorsal** dentro de (club, temporada); no duplica.
- Nombre del club = nombre del equipo en la sala.
- v1: solo da de alta los jugadores que faltan; **no** pisa nombre/portería de los ya enlazados.

## Verificación

- `test/promote-catalog.test.ts` (pg-mem): crea clubes + jugadores y enlaza el partido; idempotente;
  reutiliza por dorsal.
- **142 tests web** + **12 raíz** en verde · `tsc` limpio · `next build` compilando.
