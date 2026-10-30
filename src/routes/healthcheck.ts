import { Hono } from "@hono/hono";

export const healthcheck = new Hono();

// Sin cache
// El cliente debe comprobar que se puedo alcanzar el servidor
healthcheck.get("/", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ status: "ok", time: new Date().toISOString() }, 200);
});
