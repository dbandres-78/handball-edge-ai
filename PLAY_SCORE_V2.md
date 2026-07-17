# Play Score v2 — términos defensivos

## Qué cambia respecto a v1

v1 puntuaba solo el núcleo ofensivo/portero. Los eventos defensivos se **registraban** pero no
puntuaban: un pivote que roba tres balones y bloca dos tiros aparecía con Play Score 0.

v2 los puntúa. El precio a pagar es epistémico, y se hace explícito en lugar de esconderlo.

## Dos familias de pesos, con estatus distinto

| Familia | Términos | Procedencia | Estatus |
|---|---|---|---|
| `fitted` | gol +1.8, fallo −1.0, pérdida −0.55, parada +1.84 | Regresión sobre los informes (Ola 3) | R² ≈ 0.50 campo · 0.63 portero |
| `prior` | recuperación +1.4, blocaje +1.0, falta −0.1, exclusión 2′ −1.2, roja −2.5 | Juicio experto | **Sin calibrar** |

El motivo de que los defensivos no estén ajustados es concreto: **el informe no exporta eventos
defensivos**, así que no hay variable dependiente contra la que regresar. No es un descuido, es la
frontera de los datos de origen. Se activan ahora porque la plataforma **ya captura esos eventos por
sí misma** (etiquetado en la sala de análisis) — que era justamente el requisito.

## Cómo se mantiene la honestidad

- Cada término del desglose lleva `origin: 'fitted' | 'prior'`.
- `PlayScore` expone `fittedTotal` y `priorTotal` además de `total`: se puede auditar **cuánto del
  número viene de pesos calibrados y cuánto de juicio experto**.
- La UI marca los términos prior con una etiqueta ámbar y muestra ambos subtotales.
- Consecuencia útil: `fittedTotal` sigue siendo comparable con el score de referencia de los
  informes históricos; `total` es el score propio de la plataforma.

## Justificación de cada prior

- **Recuperación +1.4** — quita la posesión al rival y suele abrir transición. Por debajo del gol
  (+1.8): crea una ocasión, no un tanto.
- **Blocaje +1.0** — anula el tiro, pero el rechace no garantiza recuperar la posesión. Por eso vale
  menos que una recuperación.
- **Falta −0.1** — en balonmano la falta ordinaria es táctica y altísimamente frecuente; penalizarla
  con fuerza castigaría a los buenos defensores. Ligeramente negativa.
- **Exclusión 2′ −1.2** — dos minutos en inferioridad tienen un coste esperado cercano a un gol.
- **Roja −2.5** — pierde al jugador el resto del partido, más 2′ sin sustituto.
- **Amarilla: no puntúa** — es un aviso sin coste directo en juego. Si deriva en exclusión, el coste
  ya lo recoge `twoMinutes`; puntuarla sería contar dos veces lo mismo.

## Atribución del blocaje

Un tiro blocado es **un suceso con dos protagonistas**: fallo del atacante y mérito del defensor. Se
modela como un único evento canónico (`SHOT` con `outcome: BLOCKED`) que lleva `blockerId` en el
payload — igual que una parada lleva `goalkeeperId`. Si no se indica el defensor, el blocaje **no se
atribuye a nadie** (y el atacante igualmente carga con el fallo). En la sala, el defensor se
selecciona antes de marcar la acción, como la zona de la diana.

## Plan de calibración

Los priors son **provisionales por diseño**. Cuando haya volumen propio suficiente:

1. Regresar el impacto observado (diferencial de marcador en los intervalos con el jugador en pista,
   o valor esperado de posesión) contra los conteos de eventos defensivos.
2. Sustituir los priors por los pesos ajustados y cambiar su `origin` a `fitted`.
3. Contrastar: si un peso ajustado se aleja mucho de su prior, es señal de que el prior codificaba
   una intuición equivocada — merece revisión, no un cambio silencioso.

Los pesos viven en `playscore_coefficients.json` y se inyectan **por club sin desplegar**
(`parseWeights`, que falla ruidosamente si falta un término). Un club con criterio propio sobre el
valor de la defensa puede ajustar sus pesos sin tocar el código.
