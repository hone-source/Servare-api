# Servare-api

API REST con [Deno](https://deno.com) + [Hono](https://hono.dev), lista para ejecutarse en Docker.

## Estructura

```
src/
├── main.ts          # Punto de entrada: arranca el servidor con Deno.serve
├── app.ts           # Aplicación Hono: middlewares, rutas y manejo de errores
├── app_test.ts      # Tests
└── routes/
    ├── health.ts    # GET /health
    └── items.ts     # CRUD de ejemplo en /api/v1/items (en memoria)
```

## Desarrollo local

| Comando           | Descripción                     |
| ----------------- | ------------------------------- |
| `deno task dev`   | Servidor con recarga automática |
| `deno task start` | Servidor sin recarga            |
| `deno task test`  | Ejecuta los tests               |
| `deno fmt`        | Formatea el código              |
| `deno lint`       | Analiza el código               |

El servidor escucha en `http://localhost:8000` (configurable con la variable `PORT`).

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

La API queda disponible en `http://localhost:8000`. Las variables de entorno se leen de `.env` si
existe (ver `.env.example`).

## Endpoints

| Método | Ruta                | Descripción         |
| ------ | ------------------- | ------------------- |
| GET    | `/health`           | Estado del servicio |
| GET    | `/api/v1/items`     | Lista items         |
| GET    | `/api/v1/items/:id` | Obtiene un item     |
| POST   | `/api/v1/items`     | Crea un item        |
| PUT    | `/api/v1/items/:id` | Actualiza un item   |
| DELETE | `/api/v1/items/:id` | Elimina un item     |

Ejemplo:

```sh
curl -X POST localhost:8000/api/v1/items \
  -H 'Content-Type: application/json' \
  -d '{"name": "primero"}'
```
