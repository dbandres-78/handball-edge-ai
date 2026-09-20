# Informe de partido en PDF (v1)

Primera entrega de los informes visuales en PDF (18/09/2026), retomando la prioridad que quedó
pendiente: *"debemos seguir con la elaboración de los informes (jugador y partido) el xgot y el
play score defensivo antes de nada"*. Esta entrega cubre el **informe de partido**. Los informes
de equipo/temporada y de jugador individual, y la calibración de xGOT y Play Score defensivo,
quedan para las siguientes entregas (ver "Pendiente" al final).

**Actualización (mismo día) — Play Score más visible y visual.** El usuario avisó de que no veía
el Play Score en el informe (antes solo aparecía como una columna más, "PS", al final de la tabla
de rendimiento individual) y pidió que el informe fuera estéticamente más visual en general. Se
añadió:
- **"PLAY SCORE — RANKING DEL PARTIDO"**: sección propia por equipo, justo debajo del resumen y el
  mapa de gol, con un gráfico de barras horizontales divergentes (verde = positivo, rojo =
  negativo) por jugador ordenado de mayor a menor, y una insignia "MVP" para el mejor del equipo.
- **Tarjeta "MVP del partido" en la portada**: junto a dos tarjetas más (eficacia de tiro y
  balance de xG), con el MVP calculado sobre los dos equipos.
- La columna "PS" de la tabla de rendimiento individual ahora sale en negrita y coloreada
  (verde/rojo), igual que el ± de la tabla de plus/minus.
- Barras de progreso finas bajo los porcentajes de eficacia en "Zonas de lanzamiento", "Sistema de
  partido" y "Motivo de la pérdida", para que esas tablas también se lean de un vistazo.
- Cabeceras de cada subsección con una marca de color a la izquierda en vez de texto gris plano.
- De paso se corrigió un fallo de tipografía: el signo menos matemático (−) que se usaba en "G − xG"
  y en la tarjeta de balance de xG no existe en la fuente Helvetica del PDF y salía en blanco (se
  veía como "G  xG"); se sustituyó por un guion normal.

## Qué genera

Un PDF de 3 páginas por partido, usando **solo datos que ya capturamos** en la app (nada
inventado ni copiado de los informes de referencia de handball.ai, que se usaron solo como
inspiración de formato — ver sección 7 de `claude/hacia_el_informe_ideal.md`):

1. **Portada + resumen comparativo**: marcador, competición/jornada/fecha, y una tabla con
   goles/tiros, eficacia de tiro, xG/xGOT, paradas/% parada, posesiones, pérdidas,
   recuperaciones, blocajes y exclusiones de 2', local vs. visitante.
2. **Página por equipo** (una para cada uno), con:
   - Tabla resumen del equipo (los mismos indicadores que el CSV, más G−xG) y el **mapa de gol
     3×3** (zonas de portería 1-9, con intensidad por volumen).
   - **Zonas de lanzamiento** (las 8 zonas de la pista): tiros, goles, eficacia y tiros a puerta
     por zona.
   - **Sistema de partido**: veces jugada, goles, paradas, palo/fuera, 7 metros y %goles por cada
     combinación táctica (permuta, cruce, desdoblamiento, cortina, acción individual) — la
     agregación nueva que se añadió justo antes de esta entrega.
   - **Motivo de la pérdida**: veces y % del total por cada uno de los 6 motivos, con nota de
     cuántas pérdidas quedaron sin clasificar (paso opcional).
   - **Rendimiento individual**: goles, tiros, eficacia, asistencias, pérdidas, recuperaciones,
     blocajes, faltas cometidas/provocadas, xG y Play Score por jugador.
   - **Plus/minus y minutos** por jugador.
   - **Porteros** (paradas, goles recibidos, % parada) — solo si el equipo tiene algún jugador
     con paradas o marcado como portero.
   - **Composición por jugador**: barra apilada (goles/fallos/paradas/pérdidas) por jugador con
     alguna acción, con leyenda de colores.

## Cómo se genera

Mismo patrón que ya usa el CSV (`stats-csv.ts` + el botón de `StatsPanel.tsx`): se genera **en el
cliente**, a partir del objeto `LiveStats` ya calculado — nada nuevo en el servidor, ni
navegador headless. Se usa `@react-pdf/renderer` (v3, la rama estable en CommonJS; la v4 es
ESM-only y da problemas de resolución de módulos con nuestra cadena de tests en Node/`tsx` — se
probó y se descartó por eso, no por falta de funcionalidad).

- `web/lib/reports/MatchReportDocument.tsx` — el documento: tablas, mapa de gol y barras en SVG,
  paleta clara para imprimir (distinta de la paleta oscura de la app, pensada para pantalla).
- El botón **"Informe PDF"** en `StatsPanel.tsx` (junto al de exportar CSV) importa
  `@react-pdf/renderer` y el documento **de forma perezosa** (`import()` dentro del propio
  click): así el peso de la librería no engorda el paquete inicial de las páginas de directo y
  análisis (se comprobó con `next build`: sin este cuidado el "First Load JS" de esas páginas
  subía de ~120 kB a más de 550 kB; con el `import()` perezoso se queda igual que antes).

## Verificación

- `npx tsc --noEmit` (web) — limpio.
- `test/pdf-report.test.tsx` (nuevo, 3 casos): genera el PDF contra un fixture sintético que
  toca asistencias, falta provocada, sistema de partido, motivo de la pérdida, mapa de gol y
  porteros, y comprueba que el resultado es un PDF válido (cabecera `%PDF-`, tamaño razonable);
  nombre de archivo seguro; y que no lanza con datos mínimos (partido vacío, sin jugadores ni
  eventos). Wired en `npm test` (`test:pdf`).
- `npm test` (web, 31 ficheros ya con este nuevo) — todos en verde.
- `npm run build` (web, `next build`) — compila y genera todas las rutas; comprobado que las
  páginas de directo/análisis no crecen de tamaño por el import perezoso.

## Pendiente (siguientes entregas, no bloquean esta)

- **Informe de equipo/temporada** y **informe de jugador individual** en PDF — siguiente paso
  natural, reutilizando los mismos componentes (`Table`, `GoalMap`, `StackedBar`) de
  `MatchReportDocument.tsx`.
- **Cronograma por bloques de 5 minutos** y **serie partido a partido** (evolución de marcador,
  tendencia de temporada): necesitan una agregación nueva (por tiempo de juego / por lista de
  partidos) que hoy no existe; quedó explícitamente fuera del v1 desde que se acordó el alcance.
- **xGOT**: ya está implementado (ver `ZONAS_XG_XGOT.md`); falta calibrar los coeficientes con
  más partidos propios (shrinkage frecuentista) y asegurarse de que quede bien reflejado en los
  próximos informes.
- **Play Score defensivo**: bloqueado por acumular datos propios con eventos defensivos
  etiquetados; no es una tarea de código, se retoma cuando haya más partidos analizados.
