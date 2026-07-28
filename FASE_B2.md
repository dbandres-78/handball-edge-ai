# Fase B2 — Botón "Nuevo partido de vídeo" + formulario (UI)

Estado: **completada** (typecheck limpio, build OK, 116 tests web sin regresiones).
Cierra la Fase B. La persistencia ya la cubre el test de B1 (`test:catlink`).

## Qué entra

- **Componente `NewVideoMatch`** (botón verde en la cabecera de la biblioteca, junto a
  "Importar informe" y "Anotar en directo").
- **Formulario**:
  - Temporada (26/27 por defecto, editable; se crea sola si es nueva), competición, jornada.
  - Por cada lado: elegir un **club del catálogo** (precarga su plantilla de esa temporada)
    o **"➕ Club nuevo…"** y escribir su plantilla (dorsal, nombre, portero).
  - Al crear: se aseguran temporada y clubes, **los jugadores nuevos se guardan en el
    catálogo** (quedan reutilizables y aportan su `playerId`), y el partido se crea como
    vídeo **enlazado al catálogo**. Redirige a la sala de análisis para cargar el vídeo.
- **`POST /api/matches` extendido**: acepta plantillas reales, `season` y enlaces
  (`clubId`, `playerId`); si no vienen, cae a la plantilla genérica (flujo directo intacto).

## Cómo probarlo

En la biblioteca, botón **"Nuevo partido de vídeo"** → rellena temporada y los dos clubes
(nuevos o del catálogo) con su plantilla → **Crear y cargar vídeo**. Vuelve a abrirlo con
otro partido: los clubes y sus plantillas ya aparecen para reutilizar.

## Con esto, Fase B cerrada. Siguiente: Fase C

Fichas de jugador y de equipo como proyecciones multi-partido **por temporada** (total y
media por partido), usando los enlaces `player_id` / `club_id` que ya se persisten.
