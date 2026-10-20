import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { HTTPException } from "@hono/hono/http-exception";
import { logger } from "@hono/hono/logger";
import { secureHeaders } from "@hono/hono/secure-headers";
import { health } from "./routes/health.ts";
import { items } from "./routes/items.ts";

export const app = new Hono();

app.use(logger());
app.use(secureHeaders());
app.use("/api/*", cors());

app.route("/health", health);
app.route("/api/v1/items", items);

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal Server Error" }, 500);
});
