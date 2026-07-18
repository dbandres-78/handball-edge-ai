# Postgres local en Windows — guía de instalación y conexión

Objetivo: que la plataforma guarde los partidos en un PostgreSQL instalado en tu propio
ordenador, en lugar de la memoria (que se pierde al cerrar). Uso local, sin nube.

La verificación contra Postgres real (v16) ya está hecha y automatizada: migraciones,
`schema_version`, `timestamptz`, `jsonb` y el ciclo completo del repositorio pasan
16/16 comprobaciones. Tu parte es instalar Postgres y ejecutar un comando.

---

## 1. Instalar PostgreSQL (una sola vez)

1. Descarga el instalador de Windows desde https://www.postgresql.org/download/windows/
   (botón "Download the installer", elige la versión 16).
2. Ejecuta el instalador. Acepta las opciones por defecto **salvo**:
   - Cuando pida una **contraseña para el usuario `postgres`**: pon una que recuerdes
     (por ejemplo `handball`). Apúntala.
   - Puerto: deja **5432**.
   - Puedes desmarcar "Stack Builder" al final; no hace falta.
3. Al terminar, Postgres queda instalado como servicio de Windows: arranca solo con el
   ordenador. No tienes que iniciarlo a mano.

## 2. Crear la base de datos (una sola vez, con pgAdmin, sin terminal)

1. Abre **pgAdmin 4** (se instaló junto a Postgres; búscalo en el menú Inicio).
2. En el árbol de la izquierda: Servers → PostgreSQL 16 (te pedirá la contraseña del paso 1).
3. Clic derecho en **Databases → Create → Database...**
4. Nombre: `handball` → botón Save.

(Opcional pero recomendado: repite y crea también `handball_verify`, una base de datos
aparte solo para el script de verificación, que borra todo lo que toca.)

## 3. Conectar la plataforma

1. En la carpeta `web` del proyecto, crea un archivo llamado `.env.local`
   (clic derecho → Nuevo → Documento de texto; renómbralo exactamente a `.env.local`,
   sin `.txt` al final — activa "Extensiones de nombre de archivo" en la vista del
   Explorador si no lo ves).
2. Su contenido es una sola línea (sustituye `TU_CONTRASEÑA` por la del paso 1):

   ```
   DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/handball
   ```

3. Ya está. Con ese archivo presente, `npm run dev` usa Postgres automáticamente
   (el selector de repositorio activa Postgres cuando existe `DATABASE_URL`).
   Si borras o renombras el archivo, vuelve a la memoria con datos de ejemplo.

## 4. Verificar (recomendado la primera vez)

Desde la carpeta `web`, en una terminal (cmd o PowerShell):

```
npm run verify:pg
```

- Debe terminar en `16 passed, 0 failed`.
- **Ojo:** este script borra las tablas para verificar desde cero. Por eso, si ya tienes
  partidos guardados, se negará a correr y te lo dirá. En ese caso apunta el `.env.local`
  (o la variable) a la base `handball_verify` para verificar sin tocar tus datos.

Extra opcional: `npm run import:j24` importa el informe de ejemplo J24 y comprueba que
el marcador recomputado (6–4) coincide con el que valida el backend. Es también una
forma rápida de sembrar un partido real en tu base de datos.

## 5. Uso diario

```
cd web
npm run dev
```

Abre http://localhost:3000 y trabaja normal: anotar en directo, analizar vídeo o
**Importar informe** (botón nuevo en la biblioteca). Todo lo que hagas queda guardado
en tu Postgres y sigue ahí al reiniciar.

## Copias de seguridad

Tus datos viven en tu disco. Para una copia puntual, en pgAdmin: clic derecho sobre la
base `handball` → **Backup...** → elige un archivo destino → Backup. Para restaurar:
clic derecho → Restore. Hazlo de vez en cuando, sobre todo antes de actualizar código
que toque `lib/db/`.

## Problemas típicos

- **"password authentication failed"** → la contraseña del `.env.local` no coincide con
  la que pusiste al instalar. Revísala.
- **"ECONNREFUSED 127.0.0.1:5432"** → el servicio no está arrancado. En Windows:
  Servicios → `postgresql-x64-16` → Iniciar. (Normalmente arranca solo.)
- **La web muestra los partidos de ejemplo en vez de los tuyos** → el `.env.local` no se
  está leyendo: comprueba que está en la carpeta `web` (no en la raíz) y que el nombre
  es exacto. Reinicia `npm run dev` tras crearlo.
