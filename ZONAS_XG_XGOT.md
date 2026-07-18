# Zonas de lanzamiento — base de xG y xGOT

## Qué se captura ahora

Cada tiro guarda **dos coordenadas independientes**, que son las dos preguntas distintas que
responden xG y xGOT:

| Dato | Pregunta | Alimenta |
|---|---|---|
| `origin` (8 zonas de pista) | ¿Desde dónde lanza? | **xG** |
| `zone` (1..9 de portería) | ¿Dónde coloca el balón? | **xGOT** |

### Las 8 zonas de origen

Se modelan como **sectores angulares desde el centro de la portería**, no como rectángulos:

- `WING_LEFT` / `WING_RIGHT` — extremos. Sector angular muy cerrado, a cualquier distancia.
- `SIX_LEFT` / `SIX_CENTER` / `SIX_RIGHT` — 6 m izquierda / centro / derecha.
- `NINE_LEFT` / `NINE_CENTER` / `NINE_RIGHT` — 9 m izquierda / centro / derecha.

El motivo de usar sectores es que **es la geometría que explica el xG**: el extremo no falla por
estar lejos (está cerquísima), falla porque tiene un ángulo cerradísimo de portería. El 9 m centro
tiene el ángulo más abierto, pero desde lejos y con la defensa delante. Un modelo de rejilla
rectangular perdería justo eso.

## Qué se agrega

En `TeamSummary` y en cada `PlayerLine`:

```ts
byOrigin: {
  [zona]: { shots, goals, onTarget, saved, missed, blocked }
}
goalZones: { [1..9]: goles }   // solo equipo
```

`onTarget` (gol + parada) está separado a propósito: **el xGOT solo mira tiros que iban a
portería**; un tiro fuera o blocado no tiene "colocación" que valorar.

## Estado actual: xG y xGOT ACTIVOS con coeficientes de referencia

El modelo ya calcula xG y xGOT. Los coeficientes son **fijos de referencia**, derivados de los
porcentajes reales de la **primera vuelta** del club (ver `src/ingestion/application/xg_coefficients.json`
y el módulo `xg.ts`). Son priors sobre los que el modelo del club trabaja; se recalibran cuando la
plataforma acumule tiros propios suficientes.

### xG — por zona de lanzamiento

Cada zona de origen tiene su probabilidad base de gol (valor `(XG %)` de la referencia):

| Zona | xG | Muestra (primera vuelta) |
|---|---|---|
| `WING_LEFT` | 0.61 | 29/54 |
| `WING_RIGHT` | 0.63 | 30/63 |
| `SIX_LEFT` | 0.66 | 35/48 |
| `SIX_CENTER` | 0.70 | 80/104 |
| `SIX_RIGHT` | 0.62 | 40/54 |
| `NINE_LEFT` | 0.45 | 12/27 |
| `NINE_CENTER` | 0.45 | 71/130 |
| `NINE_RIGHT` | 0.45 | 18/35 |
| 7 m (penalti) | 0.75 | 56/75 |

Los tres 9 m comparten 0.45 porque la referencia no distingue lado en tiro exterior.

### xGOT — colocación en portería

Sobre los tiros **a puerta** (gol o parada), la colocación escala el xG:

```
xGOT = xG × (placement(zona) / baseline)
```

`placement(zona)` es la conversión histórica de cada zona de portería 1..9, y `baseline` (0.728)
es la conversión media ponderada sobre todas las zonas. Así, colocar en una zona más letal que la
media sube el xGOT, y colocar en una zona muy parada lo baja.

| Zona portería | placement | Muestra |
|---|---|---|
| 1 (arriba izq) | 0.808 | 42/52 |
| 2 (arriba centro) | 0.717 | 33/46 |
| 3 (arriba der) | 0.641 | 25/39 |
| 4 (media izq) | 0.662 | 51/77 |
| 5 (media centro) | **0.125** | 2/16 |
| 6 (media der) | 0.722 | 52/72 |
| 7 (abajo izq) | 0.835 | 66/79 |
| 8 (abajo centro) | 0.844 | 54/64 |
| 9 (abajo der) | 0.710 | 49/69 |

La zona 5 (centro-centro) es la de mayor parada del portero: colocar ahí hunde el xGOT. Las esquinas
bajas (7, 8) son las más convertidas. Esto reproduce el mapa de calor de la referencia.

### Qué se agrega

En `TeamSummary` y cada `PlayerLine`: `xg` y `xgot` (redondeados a 2 decimales). En el panel de
estadísticas se muestra **xG**, **xGOT** y **G–xG** (goles observados menos esperados), con color
verde/rojo según se rinda por encima o por debajo de lo esperado — igual que los porcentajes
rojo/verde de la imagen de referencia.

### Paridad garantizada

`liveStats` (frontend) llama directamente a `recomputeAggregates` (backend): el xG se calcula en un
único sitio, así que el número que ve el analista en directo es idéntico al que persiste el servidor.

## Camino de calibración (cuando haya volumen propio)

Los coeficientes de referencia son el punto de partida, no el final. Con el etiquetado propio:

1. **xG frecuentista con encogimiento**: `xG(zona) = (goles_zona + k·media_global) / (tiros_zona + k)`.
   El término `k` encoge las zonas con pocos tiros hacia la media, que es la forma honesta de no
   fiarse de un 2/2. Cuando una zona acumule tiros suficientes, su tasa propia manda sobre la referencia.
2. **Refinar con contexto**: superioridad/inferioridad, contragolpe vs ataque posicional, portero concreto.
3. **Publicar con su origen**, como el Play Score: cada número dirá si viene de la referencia o de
   datos propios, y con cuántos tiros se ha estimado.

## Nota sobre el 7 m

El penalti es una situación, no una zona de origen. `isPenalty` está en el payload y la UI ya lo marca
(toggle "Lanzamiento de 7 metros" en el panel de etiquetado). En el modelo se trata como categoría
propia con xG fijo 0.75, fuera del juego abierto: no usa zona de pista.
