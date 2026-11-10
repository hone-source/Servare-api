import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { PuntoEnvio } from "../models/punto.ts";
import { recordarResultado } from "../services/operaciones.ts";
import { actualizarPunto, borrarPunto, crearPunto, listarPuntos } from "../services/puntos.ts";
import type { PuntoVista } from "../services/puntos.ts";
import { inexistente, leerBaseVersion, leerClave, leerId, repetida } from "../utils/peticion.ts";

// Un cuerpo que no cumple el esquema es un dato no válido (422): la app lo trata como definitivo
async function leerPunto(c: Context): Promise<PuntoEnvio> {
  const body = await c.req.json().catch(() => null);
  const result = PuntoEnvio.safeParse(body);
  if (!result.success) {
    throw new HTTPException(422, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

// La versión del servidor es otra: se devuelve el punto vigente para que la app lo muestre
function conflicto(c: Context, actual: PuntoVista) {
  return c.json({ error: "El registro cambió en el servidor", actual }, 409);
}

export async function listar(c: Context) {
  return c.json(await listarPuntos());
}

// POST: la app genera el entityId. 201 si es nuevo; 409 si ya existe (con el punto vigente)
export async function crear(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const { baseVersion: _, ...punto } = await leerPunto(c);
  const resultado = await crearPunto(id, punto);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 201, resultado.punto);
  return c.json(resultado.punto, 201);
}

// PUT: exige baseVersion, la versión que la app conocía. 200 con la versión nueva;
// 409 si el servidor tiene otra (con el punto vigente); 404 si ya no existe
export async function actualizar(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const { baseVersion, ...punto } = await leerPunto(c);
  if (baseVersion == null) {
    throw new HTTPException(422, { message: "Falta baseVersion: la versión que se editó" });
  }
  const resultado = await actualizarPunto(id, punto, baseVersion);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 200, resultado.punto);
  return c.json(resultado.punto, 200);
}

// DELETE: baseVersion llega en la consulta; sin ella se borra sin comprobar la versión
export async function borrar(c: Context) {
  const id = leerId(c);
  const clave = leerClave(c);
  const previa = await repetida(c, clave);
  if (previa) return previa;

  const resultado = await borrarPunto(id, leerBaseVersion(c));
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 204, null);
  return c.body(null, 204);
}
