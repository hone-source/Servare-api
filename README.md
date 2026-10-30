# Servare-api

API REST con [Deno](https://deno.com) + [Hono](https://hono.dev), lista para ejecutarse en Docker.

## Estructura

```
src/
├── main.ts          # Punto de entrada: arranca el servidor con Deno.serve
├── app.ts           # Aplicación Hono: middlewares, rutas y manejo de errores
├── app_test.ts      # Tests
├── db.ts            # Cliente de MongoDB (MONGODB_URI)
└── routes/
    ├── db.ts        # Conexión con la base de datos
└── routes/
    ├── fichas.ts    # Fichas técnicas de levantamiento en /api/fichas
    ├── health.ts    # GET /health y /api/health
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
`MONGODB_URI`, se conecta al MongoDB de Compose en `localhost:27017` (`docker compose up -d db`).

Los tests en la base de datos solo corren si `MONGODB_URI` está definida:

```sh
MONGODB_URI='mongodb://servare:servare@localhost:27017/servare?authSource=admin' deno task test
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

MongoDB no necesita esquema: las colecciones `fichas` y `pruebas` se crean al insertar. Cada ficha es
un solo documento con sus listas embebidas, y su `_id` es el `entityId` (UUID) de la app. El script
`db/init/indexes.js` crea los índices, y Mongo lo ejecuta solo al crear el volumen `db-data` por
primera vez. Si el volumen ya existe, se aplica a mano:

```sh
docker compose exec -T db sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  < db/init/indexes.js
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
| GET    | `/api/healthcheck`  | Estado del servicio |
| POST   | `/api/auth/registro` | Crea una cuenta (`correo`, `contrasena`) y devuelve el token de sesión. Exige `Idempotency-Key`: 201 nueva, 200 reintento del mismo registro, 409 correo ya registrado, 422 datos no válidos |
| POST   | `/api/auth/login`   | Inicia sesión (`correo`, `contrasena`) y devuelve un token nuevo: 200, 401 correo o contraseña incorrectos (no dice cuál), 422 datos no válidos |
| GET    | `/api/pruebas`      | Lista los registros de prueba, con su `version`. Exige `Authorization: Bearer <token>`: 401 si falta, es inválido o expiró (la app lo toma como sesión expirada y pausa su cola) |
| POST   | `/api/pruebas/:id`  | Crea el registro (versión 1): 201, 409 si ya existe (con el registro vigente). Exige `Idempotency-Key` |
| PUT    | `/api/pruebas/:id`  | Actualiza. Exige `baseVersion` en el cuerpo y `Idempotency-Key`: 200 con la versión nueva, 409 si la versión del servidor es otra (con el registro vigente), 404 si ya no existe, 422 si falta `baseVersion` |
| DELETE | `/api/pruebas/:id`  | Elimina. `?baseVersion=` es opcional; con ella se comprueba la versión (409 si es otra). Exige `Idempotency-Key`: 204, 404 si no existe |
| GET    | `/api/fichas`     | Lista fichas (resumen, la más reciente primero) |
| GET    | `/api/fichas/:id` | Obtiene una ficha completa                      |
| PUT    | `/api/fichas/:id` | Crea (201) o reemplaza (200) una ficha          |
| DELETE | `/api/fichas/:id` | Elimina una ficha                               |

### Versiones y reintentos de `pruebas`

Cada registro tiene `version`, que empieza en 1 y sube con cada cambio. La app envía la que conocía
(`baseVersion`); si el servidor tiene otra, rechaza con **409** y devuelve el registro vigente:

```json
{ "error": "El registro cambió en el servidor",
  "actual": { "entityId": "…", "titulo": "…", "texto": "…", "numero": 1, "createdAt": 1, "version": 4 } }
```

El `Idempotency-Key` es el `operationId` de la app y es el mismo en todos los reintentos. Cuando una
operación se aplica, se guarda su respuesta (colección `operaciones`, 30 días): un reintento recibe lo
mismo y no se aplica dos veces, así que reenviar tras perder la conexión no genera un conflicto contra
uno mismo. Los rechazos (404, 409) no se guardan. El índice TTL está en `db/init/indexes.js`; si el
volumen ya existe, se aplica a mano como el resto.

### Health check

Para comprobar que el servicio está arriba:

```sh
curl -i https://localhost:8000/api/healthcheck
```

Una respuesta `200 OK` indica que el servicio funciona. Para usarlo en un script, `-f` hace que
`curl` falle si el estado no es 2xx:

```sh
curl -fsS https://localhost:8000/api/healthcheck > /dev/null && echo "OK" || echo "FALLO"
```

El `:id` es el `entityId` (UUID) que genera la app, así que reenviar una ficha al sincronizar la
actualiza en vez de duplicarla. El cuerpo del `PUT` es el JSON del modelo `Ficha` de la app: los
enums van por nombre (`"WIXARIKA"`), las fechas como `YYYY-MM-DD`, las horas como `HH:MM[:SS]`, y
los campos omitidos toman el mismo valor por defecto que en Kotlin.

Ejemplo:

```sh
curl -X POST localhost:8000/api/items \
  -H 'Content-Type: application/json' \
  -d '{"name": "primero"}'
```
# Servare-api
