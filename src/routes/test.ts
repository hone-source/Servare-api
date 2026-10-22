import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";

export const test = new Hono();

// Ruta para visualizar contenido resibido 
test.get("/", (c: Context) => {
  c.header("Cache-Control", "no-store");
  console.log("*///////////////INICIO///////////////*");
  console.log(c);
  console.log("*////////////////FIN////////////////*");
  return c.json({ status: "ok", time: new Date().toISOString() }, 200);
});
