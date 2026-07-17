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

## Qué NO está hecho: el modelo

**Todavía no se calcula xG ni xGOT, y no se calculan a propósito.** Un xG es una probabilidad
estimada, y estimarla necesita datos:

- Con los tiros de un partido, la conversión por zona es **ruido**, no una probabilidad. Un 2/2
  desde 6 m centro no significa "xG = 1.0".
- No hay tablas públicas fiables de balonmano por zona equivalentes a las del fútbol, y copiar
  coeficientes inventados sería peor que no tener xG: daría una cifra con aspecto científico y sin
  respaldo.

Lo que **sí** hace la plataforma ahora es capturar y agregar exactamente lo que el modelo necesita,
y mostrar la **eficacia observada por zona** (goles/tiros), que es un dato real y auditable.

## Plan para activarlos

1. **Acumular volumen propio**: con el etiquetado (vídeo y directo) cada partido añade tiros con
   `origin` + `outcome` + `zone`.
2. **xG base (frecuentista con encogimiento)**: `xG(zona) = (goles_zona + k·media_global) / (tiros_zona + k)`.
   El término `k` encoge las zonas con pocos tiros hacia la media global, que es la forma honesta de
   no fiarse de un 2/2. Cuando una zona acumule suficientes tiros, su tasa manda.
3. **Refinar con contexto**: superioridad/inferioridad numérica, contragolpe vs ataque posicional,
   penalti (`isPenalty` ya está en el payload), portero concreto.
4. **xGOT**: sobre los tiros a puerta, probabilidad de gol dada la colocación (`zone` 1..9),
   condicionada al origen. Es la métrica que separa *generar ocasiones* (xG) de *ejecutarlas*
   (xGOT − xG), y la que mide de verdad al portero: paradas por encima de lo esperado.
5. **Publicar con su origen**, igual que el Play Score: cada número dirá si viene de datos ajustados
   o de un prior, y con cuántos tiros se ha estimado.

## Nota sobre el 7 m

El penalti no es una zona de origen: es una situación. Ya existe `isPenalty` en el payload del tiro
y, cuando se etiquete, debe tratarse como categoría propia en el modelo (su xG ronda valores muy
distintos a cualquier tiro en juego). Hoy la UI todavía no lo marca — es el siguiente hueco a cerrar.
