import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { PruebaEnvio } from "../models/prueba.ts";
import { recordarResultado } from "../services/operaciones.ts";
import { actualizarPrueba, borrarPrueba, crearPrueba, listarPruebas } from "../services/pruebas.ts";
import type { PruebaVista } from "../services/pruebas.ts";
import { inexistente, leerBaseVersion, leerClave, leerId, repetida } from "../utils/peticion.ts";

async function leerPrueba(c: Context): Promise<PruebaEnvio> {
  const body = await c.req.json().catch(() => null);
  const result = PruebaEnvio.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

// La versión del servidor es otra: se devuelve el registro vigente para que la app lo muestre
function conflicto(c: Context, actual: PruebaVista) {
  return c.json({ error: "El registro cambió en el servidor", actual }, 409);
}

export async function listar(c: Context) {
  return c.json(await listarPruebas());
}

// POST: la app genera el entityId. 201 si es nuevo; 409 si ya existe (con el registro vigente)
export async function crear(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const { baseVersion: _, ...prueba } = await leerPrueba(c);
  const resultado = await crearPrueba(id, prueba);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 201, resultado.prueba);
  return c.json(resultado.prueba, 201);
}

// PUT: exige baseVersion, la versión que la app conocía. 200 con la versión nueva;
// 409 si el servidor tiene otra (con el registro vigente); 404 si ya no existe
export async function actualizar(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const { baseVersion, ...prueba } = await leerPrueba(c);
  if (baseVersion == null) {
    throw new HTTPException(422, { message: "Falta baseVersion: la versión que se editó" });
  }
  const resultado = await actualizarPrueba(id, prueba, baseVersion);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 200, resultado.prueba);
  return c.json(resultado.prueba, 200);
}

// DELETE: baseVersion llega en la consulta; sin ella se borra sin comprobar la versión
export async function borrar(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const resultado = await borrarPrueba(id, leerBaseVersion(c));
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 204, null);
  return c.body(null, 204);
}
