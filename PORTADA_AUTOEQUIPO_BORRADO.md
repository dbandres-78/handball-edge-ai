# Portada, auto-equipo y borrado de jugadores

Tres mejoras.

## 1 · Auto-equipo al acabar la posesión
Al anotar un **tiro** o una **pérdida**, el equipo activo cambia solo al rival (la pelota pasa de
manos), mostrando su plantilla sin tocar la pestaña. La **recuperación** no cambia (ya se anota en el
equipo que roba). Hay un interruptor **"Auto-equipo"** en el panel de anotación, activado por defecto,
para desactivarlo cuando en vídeo quieras anotar varias cosas seguidas del mismo equipo. En directo y
en vídeo.

## 2 · Borrar jugador (clubes y fichas)
Botón **Borrar** en la ficha del jugador, con dos ámbitos:
- **Borrar de esta temporada:** solo esa pertenencia (club + temporada).
- **Borrar definitivamente:** toda su identidad (todas sus etapas y su carrera).

El borrado es **solo del catálogo**: las acciones ya anotadas en los partidos **no se tocan**, así que
la estadística de equipo queda intacta. El jugador desaparece de clubes y fichas (la proyección excluye
a los borrados). Repo con `removePersonPlayers`, DELETE con `?scope=all`.

## 3 · Portada de inicio
Nueva portada en `/` (deja de saltar a partidos) con el nombre de la app y el crédito, en los colores
del Campus Balonmano Ebro (rojo, azul, blanco y negro), y cuatro accesos: **Biblioteca de partidos**,
**Clubes y fichas**, **Directo** (alta en vivo) y **Scouting** (alta de vídeo). "Directo" y "Scouting"
abren directamente el alta existente (vía `?new=live` / `?new=video`).

Nota: puse el crédito como "Daniel Andrés"; dime el nombre exacto si quieres otro y lo cambio.

## Verificación
- **171 tests web** + **12 raíz** en verde · `tsc` limpio (web y raíz) · `next build` compilando.
