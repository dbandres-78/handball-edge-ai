# Fase C — Fichas de jugador y equipo (por club y temporada)

Fichas multi-partido como proyección on-demand, en dos sub-olas.

## C1 · Núcleo: on/off por fase

`PlayerLine` gana `onCourt` (`OnCourtSplits`): por cada posesión, además del ±, se atribuye la
posesión (y el gol) a los jugadores **en pista** de los dos equipos, separada por fase. Con eso se
calcula la eficacia del jugador con él en el campo:

- Ofensiva = ataque posicional · Contra = contraataque (goles a favor / posesiones on-court)
- Defensiva = defensa posicional · Repliegue = defensa vs contraataque rival (1 − eficiencia del rival)

Las posesiones cerradas por robo entran en los totales (`offPoss`/`defPoss`) pero no en el desglose
por fase. Reconstrucción de «quién está en pista» = la misma del ± (titulares + cambios etiquetados).
Test `web/test/oncourt.test.ts` (titular, suplente sin minutos, robo sin fase, cambio).

## C2 · Agregación + fichas

`features/catalog/projection.ts` — `buildClubProjection(matches, clubId, season)`: recorre los
partidos enlazados al club en esa temporada, recompone cada uno (`liveStats`) y agrega. Los
jugadores se agregan por su `playerId` de catálogo (no por el id canónico del partido).

- **Ficha de equipo:** récord V-E-D, goles a favor/en contra por partido, posesiones de media,
  % de pérdidas, % de acierto de tiro, eficiencia por fase media y top Play Score.
- **Ficha de jugador:** Play Score total y media/partido, goles, tiros, % acierto, pérdidas,
  recuperaciones, xG, ± total y medio, **% de pérdidas por posesiones jugadas** y las cuatro
  eficacias con él en pista (ofensiva, contra, defensa, repliegue).

Ruta `GET /api/catalog/clubs/[clubId]/projection?season=…` (proyección on-demand; sin tabla nueva).
UI: biblioteca → **Clubes y fichas** → club → selector de temporada → ficha de equipo + fichas de
jugador expandibles. Test `web/test/projection.test.ts` (filtro por club/temporada, récord,
agregación del jugador y sus eficacias, ranking).

Nota: las fichas son por **club + temporada**; la carrera de un jugador entre clubes (que la ficha
le siga al fichar por otro club) necesita identidad global de jugador y queda para una sub-ola C3.

## Verificación

- **157 tests web** + **12 raíz** en verde · `tsc` limpio (web y raíz) · `next build` compilando.
