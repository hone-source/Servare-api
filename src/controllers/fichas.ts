import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { FichaEnvio } from "../models/ficha.ts";
import { actualizarFicha, borrarFicha, crearFicha, listarFichas } from "../services/fichas.ts";
import type { FichaVista } from "../services/fichas.ts";
import { inexistente, leerBaseVersion, leerClave, leerId, repetida } from "../utils/peticion.ts";

async function leerFicha(c: Context): Promise<FichaEnvio> {
  const body = await c.req.json().catch(() => null);
  const result = FichaEnvio.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

// La versión del servidor es otra: se devuelve la ficha vigente para que la app la muestre
function conflicto(c: Context, actual: FichaVista) {
  return c.json({ error: "El registro cambió en el servidor", actual }, 409);
}

export async function listar(c: Context) {
  return c.json(await listarFichas());
}

// POST: la app genera el entityId. 201 si es nueva; 409 si ya existe (con la ficha vigente)
export async function crear(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const { baseVersion: _, ...ficha } = await leerFicha(c);
  const resultado = await crearFicha(id, ficha);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 201, resultado.ficha);
  return c.json(resultado.ficha, 201);
}

// PUT: exige baseVersion, la versión que la app conocía. 200 con la versión nueva;
// 409 si el servidor tiene otra (con la ficha vigente); 404 si ya no existe
export async function actualizar(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const { baseVersion, ...ficha } = await leerFicha(c);
  if (baseVersion == null) {
    throw new HTTPException(422, { message: "Falta baseVersion: la versión que se editó" });
  }
  const resultado = await actualizarFicha(id, ficha, baseVersion);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 200, resultado.ficha);
  return c.json(resultado.ficha, 200);
}

// DELETE: baseVersion llega en la consulta; sin ella se borra sin comprobar la versión
export async function borrar(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const resultado = await borrarFicha(id, leerBaseVersion(c));
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 204, null);
  return c.body(null, 204);
}
