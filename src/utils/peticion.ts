import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { ClaveOperacion } from "../models/operacion.ts";
import { resultadoPrevio } from "../services/operaciones.ts";

// Lo común a los recursos que la app sincroniza (fichas, pruebas)

export function leerId(c: Context): string {
  const result = z.guid().safeParse(c.req.param("id"));
  if (!result.success) {
    throw new HTTPException(400, { message: "El id del registro debe ser un UUID" });
  }
  return result.data;
}

// El operationId de la app viaja en Idempotency-Key y es el mismo en todos los reintentos
export function leerClave(c: Context): string {
  const clave = ClaveOperacion.safeParse(c.req.header("Idempotency-Key"));
  if (!clave.success) {
    throw new HTTPException(422, { message: "Falta la cabecera Idempotency-Key" });
  }
  return clave.data;
}

// Si la operación ya se aplicó, se responde lo mismo que la primera vez y no se vuelve a aplicar
export async function repetida(c: Context, clave: string) {
  const previo = await resultadoPrevio(clave);
  if (!previo) return null;
  if (previo.cuerpo === null) return c.body(null, previo.estado as 204);
  return c.json(previo.cuerpo, previo.estado as 200);
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
