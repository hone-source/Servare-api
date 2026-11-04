# Servare-api

API REST de Servare, la app de levantamiento de fichas técnicas de espacios sagrados. Sincroniza con
la app Android los datos que ella captura sin conexión: cuentas de usuario, fichas y registros de
prueba, con control de versiones y reintentos seguros.

## Tecnologías

| Pieza                      | Uso                                                                         |
| -------------------------- | --------------------------------------------------------------------------- |
| [Deno](https://deno.com)   | Entorno de ejecución y herramientas (tests, formato, lint)                  |
| [Hono](https://hono.dev) 4 | Framework web (`@hono/hono` desde JSR): rutas, CORS, cabeceras seguras, JWT |
| MongoDB 8                  | Base de datos, con el driver oficial `mongodb` 6                            |
| [Zod](https://zod.dev) 4   | Validación de los cuerpos JSON                                              |
| JWT (HS256)                | Token de sesión, firmado con `JWT_SECRET` y con vigencia de 30 días         |
| PBKDF2-SHA256              | Hash de contraseñas (600 000 iteraciones, Web Crypto, sin dependencias)     |
| Docker Compose             | API y MongoDB para desarrollo                                               |
| mkcert                     | Certificados HTTPS de desarrollo                                            |

## Estructura

```
src/
├── main.ts              # Punto de entrada: Deno.serve (HTTPS si hay TLS_CERT y TLS_KEY)
├── app.ts               # Aplicación Hono: middlewares, rutas y manejo de errores
├── config/
│   ├── auth.ts          # Secreto JWT (JWT_SECRET)
│   └── db.ts            # Cliente de MongoDB (MONGODB_URI)
├── routes/              # Rutas: asocian cada método y ruta con su controlador
│   ├── auth.ts          # /api/auth: registro y login
│   ├── fichas.ts        # /api/fichas
│   ├── pruebas.ts       # /api/pruebas
│   ├── healthcheck.ts   # /api/healthcheck
│   └── test.ts          # /api/test (depuracion, asi que ignora este)
├── controllers/         # Leen la petición, validan y arman la respuesta HTTP
├── services/            # Acceso a MongoDB y reglas de versión
│   ├── usuarios.ts
│   ├── fichas.ts
│   ├── pruebas.ts
│   └── operaciones.ts   # Resultados guardados para la idempotencia
├── models/              # Esquemas Zod: usuario, ficha, prueba, operación
├── middlewares/
│   └── autenticacion.ts # Exige el token de sesión (Authorization: Bearer)
└── utils/
    ├── contrasena.ts    # Hash y verificación de contraseñas
    └── peticion.ts      # Id, Idempotency-Key y baseVersion comunes a fichas y pruebas
test/
└── app_test.ts          # Tests
db/
└── init/
    └── indexes.js       # Índices de MongoDB (se ejecuta al crear el volumen)
certs/                   # Certificados de mkcert (no versionados)
```

## Desarrollo local

| Comando           | Descripción                     |
| ----------------- | ------------------------------- |
| `deno task dev`   | Servidor con recarga automática |
| `deno task start` | Servidor sin recarga            |
| `deno task test`  | Ejecuta los tests               |
| `deno fmt`        | Formatea el código              |
| `deno lint`       | Analiza el código               |

El servidor escucha en `http://localhost:8000` (configurable con `PORT`). Sirve HTTPS solo si se
definen `TLS_CERT` y `TLS_KEY`, Compose lo hace, `deno task` no.

Deno no lee `.env` por sí solo, así que las variables se pasan en el entorno. Registro, login y
fichas necesitan `JWT_SECRET`, sin él responden 500:

```sh
docker compose up -d db
JWT_SECRET=solo-para-desarrollo deno task dev
```

### Variables de entorno

| Variable                                   | Descripción                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `PORT`                                     | Puerto del servidor (8000 por defecto)                                                               |
| `JWT_SECRET`                               | Secreto con el que se firman los tokens de sesión. Obligatorio                                       |
| `MONGODB_URI`                              | Conexión a MongoDB. Por defecto `mongodb://servare:servare@localhost:27017/servare?authSource=admin` |
| `TLS_CERT`, `TLS_KEY`                      | Rutas del certificado y la llave para servir HTTPS                                                   |
| `MONGO_USER`, `MONGO_PASSWORD`, `MONGO_DB` | Credenciales y base que usa Compose (`servare` por defecto)                                          |

`.env.example` es la plantilla de `.env`, que Compose lee si existe. Ojo: sus valores de MongoDB
(`admin`/`admin`) no son los predeterminados de Compose (`servare`/`servare`), si copia el archivo,
use esas credenciales en `MONGODB_URI`.

### Tests

Los tests que usan la base de datos solo corren si `MONGODB_URI` está definida:

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

La API queda disponible en `https://localhost:8000` y MongoDB solo en `127.0.0.1:27017`. Compose usa
`JWT_SECRET=solo-para-desarrollo` si no se define otro, en cualquier otro entorno hay que definirlo.

### Base de datos

MongoDB no necesita esquema: las colecciones se crean al insertar.

| Colección     | Contenido                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------ |
| `usuarios`    | Cuentas. `_id` es un UUID generado por el servidor, guardan `correo` y el hash             |
| `fichas`      | Una ficha por documento, con sus listas embebidas. `_id` es el `entityId` (UUID) de la app |
| `pruebas`     | Registros de la pantalla de prueba. `_id` es el `entityId` de la app                       |
| `operaciones` | Resultado de las operaciones ya aplicadas, para la idempotencia                            |

`db/init/indexes.js` crea los índices (correo único en `usuarios`, `updatedAt` en `fichas` y el TTL
de `operaciones`). Mongo lo ejecuta solo al crear el volumen `db-data` por primera vez. Si el
volumen ya existe, se aplica a mano:

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
chmod 644 certs/dev-key.pem  # mkcert la crea con 600, el usuario `usuario` del contenedor debe poder leerla
```

- `10.0.2.2` es la PC vista desde el emulador de Android, `<IP-LAN>` es para dispositivos físicos.
  Si la IP LAN cambia, se regenera el certificado.
- La app Android confía en esta CA copiando `"$(mkcert -CAROOT)/rootCA.pem"` a su build debug.
- `rootCA-key.pem` (en `mkcert -CAROOT`) nunca se copia ni se comparte.

## Endpoints

Todas las rutas cuelgan de `/api` y responden JSON. Los errores tienen la forma
`{ "error": "mensaje" }`.

| Método | Ruta                 | Sesión | Descripción                                                |
| ------ | -------------------- | ------ | ---------------------------------------------------------- |
| GET    | `/api/healthcheck`   | No     | Estado del servicio                                        |
| POST   | `/api/auth/registro` | No     | Crea una cuenta y devuelve la sesión                       |
| POST   | `/api/auth/login`    | No     | Inicia sesión y devuelve un token nuevo                    |
| GET    | `/api/fichas`        | Sí     | Lista las fichas                                           |
| POST   | `/api/fichas/:id`    | Sí     | Crea una ficha                                             |
| PUT    | `/api/fichas/:id`    | Sí     | Actualiza una ficha                                        |
| DELETE | `/api/fichas/:id`    | Sí     | Elimina una ficha                                          |
| GET    | `/api/pruebas`       | Sí     | Lista los registros de prueba                              |
| POST   | `/api/pruebas/:id`   | Sí     | Crea un registro de prueba                                 |
| PUT    | `/api/pruebas/:id`   | Sí     | Actualiza un registro de prueba                            |
| DELETE | `/api/pruebas/:id`   | Sí     | Elimina un registro de prueba                              |
| POST   | `/api/test`          | No     | Depuración: imprime la petición en la consola del servidor |

Cualquier otra ruta responde `404 { "error": "Not Found" }`.

### Health check

```sh
curl -i https://localhost:8000/api/healthcheck
```

Responde `200` con `{ "status": "ok", "time": "<fecha ISO>" }` y `Cache-Control: no-store`. No pide
sesión: la app lo usa antes de iniciarla. Para un script, `-f` hace que `curl` falle si el estado no
es 2xx:

```sh
curl -fsS https://localhost:8000/api/healthcheck > /dev/null && echo "OK" || echo "FALLO"
```

### Cuentas y sesión

Registro y login reciben `{ "correo": "…", "contrasena": "…" }` (el correo se normaliza a
minúsculas, la contraseña del registro tiene de 8 a 128 caracteres) y devuelven la sesión:

```json
{ "token": "…", "expiraEn": 1790000000000, "correo": "persona@ejemplo.org" }
```

`expiraEn` está en milisegundos desde epoch y el token dura 30 días: está pensado para trabajo de
campo largo sin red.

| Ruta                 | Respuestas                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/registro` | 201 cuenta nueva, 200 reintento del mismo registro, 409 correo ya registrado, 422 datos no válidos o falta `Idempotency-Key` |
| `/api/auth/login`    | 200, 401 correo o contraseña incorrectos (no dice cuál), 422 datos no válidos                                                |

El registro exige la cabecera `Idempotency-Key`. Si la app reintenta con la misma clave y la misma
contraseña, recibe la respuesta de la primera vez (200) en lugar de un 409 contra sí misma.

Las rutas de fichas y pruebas exigen `Authorization: Bearer <token>`. Si falta, es inválido o expiró
responden **401**, que la app toma como sesión expirada: pausa su cola y pide iniciar sesión.

### Fichas

El `:id` es el `entityId` (UUID) que genera la app, con otro formato la respuesta es 400. POST, PUT
y DELETE exigen `Idempotency-Key` (422 si falta).

| Método | Respuestas                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | 200 con la lista, de la más reciente a la más antigua por `createdAt`                                                                                                   |
| POST   | 201 con la ficha (versión 1), 409 si ya existe (con la ficha vigente), 400 si el cuerpo no es válido                                                                    |
| PUT    | 200 con la versión nueva, 409 si la versión del servidor es otra (con la ficha vigente), 404 si ya no existe, 422 si falta `baseVersion`, 400 si el cuerpo no es válido |
| DELETE | 204, 404 si no existe, 409 si se indica `?baseVersion=` y es otra. Sin `baseVersion` no se comprueba la versión                                                         |

No hay `GET /api/fichas/:id`: la app obtiene todo con el listado.

El cuerpo de POST y PUT es el modelo `Ficha` de la app, con el contenido dentro de `datos`:

```json
{
  "datos": {
    "pueblo": "WIXARIKA",
    "nombre": "Tukipa de prueba",
    "fechaLevantamiento": "2026-10-21"
  },
  "createdAt": 1790000000000,
  "baseVersion": 3
}
```

- `createdAt` es de la app, en milisegundos desde epoch.
- `baseVersion` es la versión que la app conocía al editar. En el PUT es obligatoria, en el POST se
  ignora.
- Los enums van por nombre (`"WIXARIKA"`), las fechas como `YYYY-MM-DD` y las horas como `HH:MM`.
- Los textos omitidos se guardan vacíos y las listas omitidas como `[]`.

El listado y las respuestas devuelven cada ficha como `{ entityId, datos, createdAt, version }`.

### Pruebas

`/api/pruebas` es el recurso de la pantalla de prueba de la app. Tiene el mismo contrato que las
fichas (sesión, `Idempotency-Key`, `baseVersion`, códigos y 409 con el registro vigente), con este
cuerpo:

```json
{ "titulo": "…", "texto": "…", "numero": 1, "createdAt": 1790000000000, "baseVersion": null }
```

### Versiones y reintentos

Cada ficha y cada prueba tiene `version`, que empieza en 1 y sube con cada cambio. La app envía la
que conocía (`baseVersion`), si el servidor tiene otra, rechaza con **409** y devuelve el registro
vigente:

```json
{ "error": "El registro cambió en el servidor",
  "actual": { "entityId": "…", "datos": { … }, "createdAt": 1, "version": 4 } }
```

El `Idempotency-Key` es el `operationId` de la app y es el mismo en todos los reintentos. Cuando una
operación se aplica, se guarda su respuesta (colección `operaciones`, 30 días): un reintento recibe
lo mismo y no se aplica dos veces, así que reenviar tras perder la conexión no genera un conflicto
contra uno mismo. Los rechazos (400, 404, 409, 422) no se guardan. El índice TTL está en
`db/init/indexes.js`, si el volumen ya existe, se aplica a mano como el resto.

### Ejemplo

```sh
# Registro: devuelve el token
curl -X POST https://localhost:8000/api/auth/registro \
  -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"correo": "persona@ejemplo.org", "contrasena": "una-larga-esta"}'

# Crear una ficha con ese token
curl -X POST "https://localhost:8000/api/fichas/$(uuidgen)" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"datos": {"nombre": "Tukipa de prueba"}, "createdAt": 1790000000000}'
```
