# Biblioteca: borrar partidos + quitar importar + exportar CSV

Estado: **completado y verificado** (126 tests web en verde, typecheck limpio, build OK).
Agrupa tres cambios (el borrado no se había subido aún).

## 1. Borrar partidos
- Papelera al pasar por encima de cada tarjeta, con confirmación. Borra el partido, todos sus
  datos y su vídeo subido. Repositorio (memoria y Postgres) + ruta `DELETE /api/matches/[id]`.
  Test `test:del`.

## 2. Quitar "Importar informe"
- Se retira el botón de la biblioteca (la herramienta es para crear informes propios). El
  componente/ruta/adaptador se **conservan** por debajo (los usan los tests); solo desaparece
  de la vista, reversible.

## 3. Exportar informe a CSV
- Botón **"Exportar informe (.csv)"** en el panel de estadísticas. Genera un CSV (con BOM para
  acentos; delimitador ';' para Excel/Numbers en español) con:
  - Cabecera: equipos, resultado, competición, jornada, fecha.
  - Resumen por equipo: goles, tiros, paradas, %parada, pérdidas, recuperaciones, blocajes,
    pases 10m, exclusiones, tarjetas, tiempos muertos, xG, xGOT.
  - Tabla por jugador: dorsal, nombre, goles, tiros, fallados, paradas, pérdidas,
    recuperaciones, blocajes, faltas, exclusiones, tarjetas, **+/-** y **Play Score**
    (total, ajustado y prior), xG, xGOT.
- Función pura `buildStatsCsv` con test `test:csv`.

## Nota sobre el informe de Handball.AI
El CSV incluye **todo lo que la plataforma calcula hoy** más lo propio (Play Score, ±). Las
métricas del informe de Handball.AI que aún NO se capturan quedan fuera hasta implementarlas:
posesiones, eficiencia por fase de ataque, superioridad/inferioridad, sistemas de juego
(cruce/permuta), asistencias y mapas de zona. Son candidatas a futuras olas de captura.
