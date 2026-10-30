import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { HTTPException } from "@hono/hono/http-exception";
import { logger } from "@hono/hono/logger";
import { secureHeaders } from "@hono/hono/secure-headers";
import { autenticacion } from "./middlewares/autenticacion.ts";
import { auth } from "./routes/auth.ts";
import { healthcheck } from "./routes/healthcheck.ts";
import { pruebas } from "./routes/pruebas.ts";
import { test } from "./routes/test.ts";

export const app = new Hono();

app.use(logger());
app.use(secureHeaders());
app.use("/api/*", cors());

// Abiertas: el health check lo usa la app antes de tener sesión, y registro/login la crean
app.route("/api/healthcheck", healthcheck); // /health para la infraestructura
app.route("/api/auth", auth);

// Con sesión: los datos exigen el token
app.use("/api/pruebas/*", autenticacion);
app.route("/api/pruebas", pruebas);

app.route("/api/test", test); // ruta /test para hacer pruebas

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});
