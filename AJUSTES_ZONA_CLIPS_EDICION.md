# Zona de tiro espejada, edición de jugadas y filtros de clips

Cuatro ajustes, construidos y verificados sobre clon limpio.

## 1 · Espejo de la zona de tiro

Las zonas se nombran desde el **ataque** (extremo izquierdo = izquierda del atacante), pero el mapa
se dibuja como se ve desde detrás de la portería defendida. Se corrige: el lado izquierdo del ataque
(EI, 6I, 9I) va a la **derecha** de la pantalla y viceversa; los centros no cambian. El click sigue
registrando el `ShotOrigin` correcto. Afecta al mapa de entrada y al de estadística (misma geometría).

## 2 · Pase a 10 m fuera de la botonera

Se quita el botón «Pase a 10m» de la botonera de la derecha (ya está en la barra morada central,
tanto en directo como en vídeo). El evento y el atajo Shift siguen igual.

## 3 · Editar jugadas en el registro

Cada fila del registro tiene ahora un botón **✎** que abre un modal para corregir un click mal
tecleado (p. ej. marcaste «parada» y era «tiro fuera»). Se puede cambiar equipo, jugador, acción,
fase y —en tiros— origen, zona de portería y 7 m. Todo se recompone desde los eventos, así que al
guardar se actualizan marcador, estadística, posesiones y clips. Nuevo `editEvent(id, patch)` en
las dos salas y editor en `EventLog`.

## 4 · Filtros de clips por acción y por zona

El panel de clips ahora filtra en tres dimensiones (suman dentro de cada una, se cruzan entre ellas):
- **Equipo:** Local / Visitante.
- **Acción:** Gol, Parada, Fuera, Blocado, Pérdida, Recuperación, Falta, Excl. 2′, Amarilla, Roja.
- **Zona de tiro:** cada origen de lanzamiento (EI, 9I, 6C… solo aplica a tiros).

`clips.ts` gana `origin` en el clip y un `matchesFilters` por dimensiones; test actualizado
(`clips.test.ts`) con acción y zona.

## Verificación

- **148 tests web** + **12 raíz** en verde · `tsc` limpio (web y raíz) · `next build` compilando.
