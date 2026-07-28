# Funcionalidad: tecla de "pases a 10 m" en directo

Contador por volumen de pases en zona de 10 m en ataque, por equipo. Sirve para
identificar equipos con más capacidad de atacar cerca (o defensas más permisivas).

## Cómo funciona

- **Barra espaciadora** → arranca/para el reloj (sin cambios).
- **Shift (⇧, izquierda o derecha)** → +1 pase a 10 m al equipo que tienes seleccionado
  como atacante (`side`). La tecla morada bajo el reloj muestra el contador de los dos
  equipos, se ilumina en el color del que ataca, y tiene **+1** y **−1** (corrección).
- El equipo que ataca se cambia en el panel de anotación (el selector Local/Visitante).

## Diseño (event-sourcing, sin duplicar)

- Nuevo evento canónico **`NEAR_PASS`** (evento de EQUIPO, sin jugador).
- Se cuenta por equipo en `recomputeAggregates`; se expone como `nearPasses` en
  `TeamSummary`. Como `liveStats` llama al mismo recompute, la paridad live/recompute sale
  automática y queda auditable en el log de eventos.
- Aparece también en el panel de estadísticas ("PASES 10M"), por equipo.

## Archivos

Núcleo: `src/ingestion/domain/match-event.ts`, `application/read-models.ts`,
`application/recompute-aggregates.ts`.
Web: `lib/handball/actions.ts`, `features/analysis/StatsPanel.tsx`,
`features/live/LiveRoom.tsx`, `test/near-pass.test.ts`, `package.json`.

## Tests

`npm run test:near` — 4 comprobaciones: cuenta por equipo, es evento de equipo (sin
jugador), aislamiento (no toca goles/tiros/Play Score) y arranque a 0.
