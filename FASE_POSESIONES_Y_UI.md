# Fase de ataque, posesiones y ajustes de UI

Dos olas construidas, testeadas y verificadas sobre clon limpio.

## Ola A — Fase de ataque y posesiones (estadística)

**Fase.** Nuevo `AttackPhase` (Posicional / Contraataque). En el panel de anotación, un selector de
fase **encima de la botonera**, elegible antes de cada acción (arranca en Posicional y mantiene la
última, pero la cambias cuando quieras). La fase se adjunta a **tiro** (incluido el 7 m) y **pérdida**.

**Posesiones.** Se cuentan por **cambio real de balón**: una posesión del equipo termina cuando
**tira** (SHOT), **pierde el balón** (TURNOVER) o **se lo roban** (STEAL del rival). Se sigue quién
tiene el balón (`holder`) y un flag de robo pendiente para **no doblar** el conteo cuando la pérdida
propia y la recuperación del rival se anotan por separado (funciona en cualquier orden). Las
posesiones cerradas por robo entran en el total pero **no llevan fase** (nadie la tecleó), así que la
suma por fase puede ser ≤ el total. Es lo honesto.

**Eficiencia.** goles / posesiones, global y por fase. **Espejo defensivo** derivado: la eficacia del
rival en *defensa* = 100 − tu eficiencia posicional; en *repliegue* = 100 − tu eficiencia en contra.

**Dónde toca.**
- Núcleo (`src/ingestion`): `AttackPhase` + `phase` en `ShotPayload`/`TurnoverPayload`; `TeamSummary`
  con `possessions`, `possessionsByPhase`, `goalsByPhase`; conteo en `recompute-aggregates`.
- Web: `UiEvent.phase` y su propagación al payload; selector de fase en `TagPanel`; `phase` cableada
  en las dos salas (vídeo y directo); bloque **Posesiones y fases** en `StatsPanel` con el espejo
  defensivo; posesiones y eficiencia por fase añadidas al CSV.
- Test `web/test/possessions.test.ts` (6 casos): conteo, dedup en ambos órdenes, 7 m con fase,
  eficiencia por fase. Sigue verde la paridad live/recompute.

## Ola B — Layout del vídeo + pase a 10 m

- **Rebalanceo:** el panel lateral pasa de 384 a 480 px y el vídeo queda algo menor; la **zona de
  tiro** crece (210→300) y la **portería** (100→150) para que se vean bien.
- **Pase a 10 m en vídeo:** la barra morada del directo se extrae a un componente compartido
  (`NearPassBar`) y aparece también bajo el reproductor en la sala de vídeo. Se acciona con **Shift
  (⇧)** como toque limpio — sin chocar con Shift+flecha, que sigue siendo el avance por frames — y
  con +1 / −1. El espacio en vídeo sigue siendo play/pausa.

## Verificación

- **148 tests web** + **12 raíz** en verde · `tsc` limpio (web y raíz) · `next build` compilando.
