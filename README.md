# Servare-api

API REST con [Deno](https://deno.com) + [Hono](https://hono.dev), lista para ejecutarse en Docker.

## Estructura

```
src/
├── main.ts          # Punto de entrada: arranca el servidor con Deno.serve
├── app.ts           # Aplicación Hono: middlewares, rutas y manejo de errores
├── app_test.ts      # Tests
├── db.ts            # Cliente de PostgreSQL (DATABASE_URL)
└── routes/
    ├── db.ts        # Conexión con la base de datos
└── routes/
    ├── fichas.ts    # Fichas técnicas de levantamiento en /api/v1/fichas
    ├── health.ts    # GET /health y /api/v1/health
db/
└── init/            # Esquema de la base de datos
```

## Desarrollo local

| Comando           | Descripción                     |
| ----------------- | ------------------------------- |
| `deno task dev`   | Servidor con recarga automática |
| `deno task start` | Servidor sin recarga            |
| `deno task test`  | Ejecuta los tests               |
| `deno fmt`        | Formatea el código              |
| `deno lint`       | Analiza el código               |

El servidor escucha en `http://localhost:8000` (configurable con la variable `PORT`). Sin
`DATABASE_URL`, se conecta al Postgres de Compose en `localhost:5432` (`docker compose up -d db`).

Los tests de fichas en la base de datos solo corren si `DATABASE_URL` está definida:

```sh
DATABASE_URL=postgres://servare:servare@localhost:5432/servare deno task test
```

## Docker

```sh
docker compose up --build
```

Para desarrollar dentro del contenedor con recarga automática:

```sh
docker compose watch
```

Los cambios en `src/` se sincronizan y reinician el contenedor. Los cambios en `deno.json` o
`deno.lock` reconstruyen la imagen.

La API queda disponible en `https://localhost:8000`. Las variables de entorno se leen de `.env` si
existe (ver `.env.example`).

### Base de datos

El esquema está en `db/init/` y Postgres lo ejecuta solo al crear el volumen `db-data` por primera
vez. Si el volumen ya existe, se aplica a mano:

```sh
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < db/init/001_fichas.sql
```

### HTTPS de desarrollo (mkcert)

Compose sirve HTTPS con los certificados de `./certs` (no versionados). Para generarlos una vez:

```sh
sudo apt install mkcert libnss3-tools
mkcert -install    # CA local de confianza en la PC (curl, navegador)
mkdir -p certs
mkcert -cert-file certs/dev.pem -key-file certs/dev-key.pem localhost 127.0.0.1 10.0.2.2 <IP-LAN>
chmod 644 certs/dev-key.pem  # mkcert la crea con 600; el usuario `deno` del contenedor debe poder leerla
```

- `10.0.2.2` es la PC vista desde el emulador de Android; `<IP-LAN>` es para dispositivos físicos.
  Si la IP LAN cambia, se regenera el certificado.
- La app Android confía en esta CA copiando `"$(mkcert -CAROOT)/rootCA.pem"` a su build debug.
- `rootCA-key.pem` (en `mkcert -CAROOT`) nunca se copia ni se comparte.

## Endpoints

| Método | Ruta                | Descripción         |
| ------ | ------------------- | ------------------- |
| GET    | `/api/v1/health`    | Estado del servicio |
| GET    | `/api/v1/fichas`     | Lista fichas (resumen, la más reciente primero) |
| GET    | `/api/v1/fichas/:id` | Obtiene una ficha completa                      |
| PUT    | `/api/v1/fichas/:id` | Crea (201) o reemplaza (200) una ficha          |
| DELETE | `/api/v1/fichas/:id` | Elimina una ficha                               |

El `:id` es el `entityId` (UUID) que genera la app, así que reenviar una ficha al sincronizar la
actualiza en vez de duplicarla. El cuerpo del `PUT` es el JSON del modelo `Ficha` de la app: los
enums van por nombre (`"WIXARIKA"`), las fechas como `YYYY-MM-DD`, las horas como `HH:MM[:SS]`, y
los campos omitidos toman el mismo valor por defecto que en Kotlin.

Ejemplo:

```sh
curl -X POST localhost:8000/api/v1/items \
  -H 'Content-Type: application/json' \
  -d '{"name": "primero"}'
```
