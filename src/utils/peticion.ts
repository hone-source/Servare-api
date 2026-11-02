import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";

// Lo común a los recursos que la app sincroniza (fichas)

export function leerId(c: Context): string {
  const result = z.guid().safeParse(c.req.param("id"));
  if (!result.success) {
    throw new HTTPException(400, { message: "El id del registro debe ser un UUID" });
  }
  return result.data;
}

// baseVersion llega en la consulta del DELETE; sin ella se borra sin comprobar la versión
export function leerBaseVersion(c: Context): number | null {
  const texto = c.req.query("baseVersion");
  if (texto === undefined) return null;
  const base = z.coerce.number().int().nonnegative().safeParse(texto);
  if (!base.success) {
    throw new HTTPException(422, { message: "baseVersion debe ser un entero" });
  }
  return base.data;
}

export function inexistente(): never {
  throw new HTTPException(404, { message: "Registro no encontrado" });
}
