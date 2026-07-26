# Handball Edge AI en Mac — puesta en marcha

Guía para dejar el Mac listo para **analizar partidos y cortar clips**. Se hace una sola vez.
Al final tendrás un comando (`npm run doctor`) que comprueba solo si todo está en orden.

Necesitas tres cosas: **Node** (mueve la aplicación), **ffmpeg** (corta el vídeo) y
**Postgres** (guarda los datos). Nada de esto se paga ni requiere cuenta.

---

## Abrir la Terminal

Varios pasos se hacen ahí. Para abrirla: pulsa **Cmd + Espacio**, escribe `Terminal` y Enter.
Se escribe (o se pega) una línea y se pulsa Enter. Si te pide la contraseña del Mac, escríbela
—no se ve nada mientras escribes, es normal— y Enter.

## 1. Homebrew (el instalador de programas)

Es la vía estándar en Mac para instalar herramientas. Pega esto en Terminal:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Tarda unos minutos. Al final puede pedirte ejecutar dos líneas más que empiezan por
`echo >> /Users/tu-usuario/.zprofile` — hazlo si lo indica, y **cierra y vuelve a abrir la
Terminal** después.

Para comprobar que quedó bien: `brew --version` debe responder con un número.

> Si ya tenías Homebrew, sáltate este paso.

## 2. Node y ffmpeg

Una sola línea instala ambos:

```
brew install node ffmpeg
```

**ffmpeg es el que corta los clips.** Sin él la aplicación arranca, pero al pedir un corte
fallará. Tarda un rato porque trae muchos componentes de vídeo.

## 3. Postgres (guardar los partidos)

La forma más simple en Mac es **Postgres.app**, sin instalador ni contraseñas:

1. Descarga desde https://postgresapp.com
2. Arrastra la app a **Aplicaciones** y ábrela (si el Mac avisa de que es de internet,
   pulsa *Abrir*).
3. Pulsa **Initialize** (o *Start*). Cuando el punto se ponga verde, ya está funcionando.
4. Marca la casilla para que arranque al iniciar sesión, y así no tendrás que acordarte.

Ahora crea la base de datos. En la ventana de Postgres.app haz **doble clic sobre la base
`postgres`**: se abre una terminal ya conectada. Escribe exactamente esto y Enter:

```
CREATE DATABASE handball;
```

Debe responder `CREATE DATABASE`. Escribe `\q` y Enter para salir.

> Tu nombre de usuario de Postgres es el mismo que el del Mac, y no lleva contraseña.
> Para saberlo, en Terminal: `whoami`

## 4. Conectar la aplicación a la base

En la carpeta `web` del proyecto hay que crear un archivo llamado `.env.local`.
Como empieza por punto, el Finder lo oculta; lo más cómodo es crearlo desde Terminal.

Primero ve a la carpeta del proyecto (arrastra la carpeta sobre la Terminal después de
escribir `cd ` y se rellena la ruta sola):

```
cd /ruta/hasta/handball-edge-ai/web
```

Y crea el archivo sustituyendo `TU_USUARIO` por lo que te haya dicho `whoami`:

```
echo "DATABASE_URL=postgresql://TU_USUARIO@localhost:5432/handball" > .env.local
```

## 5. Instalar y comprobar

Desde esa misma carpeta `web`:

```
npm install
npm run doctor
```

`doctor` revisa Node, ffmpeg (incluso hace un **corte de prueba real**), la conexión con
Postgres, los permisos y el espacio libre. Si algo falta, te dice en la propia pantalla
qué comando lo arregla. El objetivo es no ver ningún ❌.

## 6. Usar la aplicación

```
npm run dev
```

Abre **http://localhost:3000** en el navegador. Para parar la aplicación, vuelve a la
Terminal y pulsa **Ctrl + C**. Cada vez que quieras trabajar: abrir Terminal, `cd` a la
carpeta `web`, `npm run dev`.

---

## Cortar partidos: lo que conviene saber

- **El vídeo se sube a la aplicación** y se guarda dentro del proyecto, en `.data/uploads`.
  Un partido en HD ocupa varios GB; ten espacio libre (el `doctor` te avisa).
- **Vídeos del iPhone (.mov) sirven**, igual que .mp4, .mkv y .avi.
- **Dos modos de corte**: *preciso* (recodifica, corte exacto al fotograma — el habitual para
  analizar) y *rápido* (copia directa, casi instantáneo pero ajusta al fotograma clave más
  cercano). El modo preciso usa H.264; el `doctor` verifica que tu ffmpeg lo tiene.
- **Mientras se cortan clips, no cierres la Terminal**: el trabajo lo hace ffmpeg lanzado por
  la aplicación.
- **Copias de seguridad**: si tienes iCloud Drive activo, la aplicación detecta la carpeta y
  deja ahí una copia de cada partido automáticamente. Se guarda un archivo (no usa la API de
  iCloud) para que funcione también sin conexión: cuando vuelva la red, el Mac lo sube solo.

## Problemas típicos en Mac

- **`command not found: brew`** → Homebrew no se instaló o falta reabrir la Terminal
  (paso 1). Cierra la ventana y abre otra.
- **`command not found: npm`** → falta Node: `brew install node`.
- **El corte de clips falla y todo lo demás va bien** → casi siempre es ffmpeg:
  `brew reinstall ffmpeg` y vuelve a pasar `npm run doctor`.
- **"connection refused" al conectar con la base** → Postgres.app está parado. Ábrelo y
  comprueba que el punto está verde.
- **`database "handball" does not exist`** → falta el paso 3 (crear la base).
- **Los datos desaparecen al reiniciar** → no se está leyendo el `.env.local`. Comprueba que
  está dentro de la carpeta `web` y que `npm run doctor` dice "conexión con Postgres correcta".
- **Ves los partidos de ejemplo en vez de los tuyos** → mismo caso que el anterior.

## Un apunte sobre las carpetas

Guarda el proyecto en un sitio normal, por ejemplo `~/Documentos/handball-edge-ai`.
Evita ponerlo dentro de carpetas sincronizadas con iCloud/Drive: la sincronización continua
de los vídeos y de `node_modules` (miles de archivos) hace que todo vaya lento.
