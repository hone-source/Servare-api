import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { Ficha } from "../models/ficha.ts";
import { borrarFicha, guardarFicha, listarFichas, obtenerFicha } from "../services/fichas.ts";

function leerId(c: Context): string {
  const result = z.guid().safeParse(c.req.param("id"));
  if (!result.success) {
    throw new HTTPException(400, { message: "El id de la ficha debe ser un UUID" });
  }
  return result.data;
}

async function leerFicha(c: Context): Promise<Ficha> {
  const body = await c.req.json().catch(() => null);
  const result = Ficha.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

export async function listar(c: Context) {
  return c.json(await listarFichas());
}

export async function obtener(c: Context) {
  const ficha = await obtenerFicha(leerId(c));
  if (!ficha) throw new HTTPException(404, { message: "Ficha no encontrada" });
  return c.json(ficha);
}

// La app genera el id (entityId), así que crear y actualizar son el mismo PUT: reenviar una
// ficha al sincronizar la sobrescribe en vez de duplicarla. 201 si es nueva, 200 si ya existía.
export async function guardar(c: Context) {
  const id = leerId(c);
  const ficha = await leerFicha(c);
  const creada = await guardarFicha(id, ficha);
  return c.json(ficha, creada ? 201 : 200);
}

export async function borrar(c: Context) {
  const borrada = await borrarFicha(leerId(c));
  if (!borrada) throw new HTTPException(404, { message: "Ficha no encontrada" });
  return c.body(null, 204);
}
