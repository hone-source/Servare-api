import { Hono } from "@hono/hono";

export const healthceck = new Hono();

// Sin caché: el cliente debe comprobar que alcanza el servidor, no una respuesta guardada.
healthceck.get("/", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ status: "ok", time: new Date().toISOString() });
});
