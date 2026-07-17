# Guardado en directo: cómo no perder un partido

## El problema real

En un pabellón el wifi se cae. Y cuando se cae, **se caen a la vez el servidor y la nube**: guardar
en Drive no protege de nada, porque Drive necesita exactamente la misma red que acaba de fallar.
La nube da durabilidad y copia fuera del equipo — no supervivencia durante el partido.

Antes, además, el guardado **mentía**: no comprobaba si la petición había fallado y la interfaz
decía "Guardado" igualmente. Se podía perder el partido entero creyendo que estaba a salvo.

## Cómo funciona ahora: tres capas

| Capa | Qué es | Cuándo escribe | Falla si… |
|---|---|---|---|
| **1. Dispositivo** | IndexedDB del navegador | en **cada acción**, sin red | nada: aguanta wifi caído, cierre del navegador, batería |
| **2. Servidor** | Postgres vía API | en segundo plano, con reintentos (1s → 30s) | hay red: se recupera solo |
| **3. Nube** | fichero en carpeta sincronizada | al finalizar o a mano | — es respaldo |

La regla: **la interfaz no dice "sincronizado" salvo que el servidor lo confirme**. Cuando no hay
red dice exactamente lo que pasa: *"Sin conexión · a salvo en el dispositivo"*.

### Qué ves en la cabecera

- `Guardado en el dispositivo` (ámbar) — anotado en local, pendiente de subir.
- `Sincronizando…`
- `Sincronizado 18:42` (verde) — el servidor lo confirmó.
- `Sin conexión · a salvo en el dispositivo` (rojo) — reintenta solo; nada se pierde.

Si reabres un partido con jugadas que el servidor nunca recibió (se cerró el portátil, se fue la
luz), sale un aviso ofreciendo **recuperarlas**.

## Configurar la copia en la nube (iCloud / Google Drive)

Se escribe un **fichero JSON en una carpeta sincronizada**, no se llama a la API de la nube.
Motivos: funciona sin red (el cliente de escritorio sube el fichero cuando vuelva la conexión), no
hace falta OAuth ni credenciales, y iCloud Drive no ofrece API web general.

**Opción A — automática.** Si no configuras nada, se detecta la carpeta de nube del sistema:

```
~/Library/Mobile Documents/com~apple~CloudDocs/HandballEdge   (iCloud Drive, macOS)
~/Library/CloudStorage/…                                       (Google Drive / OneDrive, macOS)
~/Google Drive/HandballEdge
```

**Opción B — explícita** (recomendada, no depende de la detección):

```bash
# iCloud Drive
export BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/HandballEdge"

# Google Drive (cliente de escritorio)
export BACKUP_DIR="$HOME/Google Drive/Mi unidad/HandballEdge"
```

Comprobar dónde va a escribir:

```bash
curl localhost:3000/api/matches/<id>/backup      # -> { dir, source, synced }
```

`source: "cloud"` o `"env"` = carpeta sincronizada. `source: "local"` = **solo en este equipo**: la
API lo dice en vez de fingir que hay copia en la nube.

Cada copia es un `NormalizedMatch` completo (`<matchId>__<fecha>.json`), el mismo contrato que la
ingesta de informes: se puede reimportar.

## Lo que esto NO resuelve todavía

- La capa 2 solo persiste de verdad con `DATABASE_URL` apuntando a un Postgres. Sin ella, el
  servidor guarda en memoria y se pierde al reiniciar (el dispositivo y la nube sí conservan).
- Si anotas desde **dos dispositivos a la vez**, gana el último que sube: no hay fusión.
- El almacén local es **por navegador**: si anotas en la tablet, la copia local está en la tablet.
