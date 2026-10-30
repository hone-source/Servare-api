import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { ClaveOperacion, PruebaEnvio } from "../models/prueba.ts";
import {
  actualizarPrueba,
  borrarPrueba,
  crearPrueba,
  listarPruebas,
  recordarResultado,
  resultadoPrevio,
} from "../services/pruebas.ts";
import type { PruebaVista } from "../services/pruebas.ts";

function leerId(c: Context): string {
  const result = z.guid().safeParse(c.req.param("id"));
  if (!result.success) {
    throw new HTTPException(400, { message: "El id del registro debe ser un UUID" });
  }
  return result.data;
}

async function leerPrueba(c: Context): Promise<PruebaEnvio> {
  const body = await c.req.json().catch(() => null);
  const result = PruebaEnvio.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

// El operationId de la app viaja en Idempotency-Key y es el mismo en todos los reintentos
function leerClave(c: Context): string {
  const clave = ClaveOperacion.safeParse(c.req.header("Idempotency-Key"));
  if (!clave.success) {
    throw new HTTPException(422, { message: "Falta la cabecera Idempotency-Key" });
  }
  return clave.data;
}

// Si la operación ya se aplicó, se responde lo mismo que la primera vez y no se vuelve a aplicar
async function repetida(c: Context, clave: string) {
  const previo = await resultadoPrevio(clave);
  if (!previo) return null;
  if (previo.cuerpo === null) return c.body(null, previo.estado as 204);
  return c.json(previo.cuerpo, previo.estado as 200);
}

// La versión del servidor es otra: se devuelve el registro vigente para que la app lo muestre
function conflicto(c: Context, actual: PruebaVista) {
  return c.json({ error: "El registro cambió en el servidor", actual }, 409);
}

function inexistente(): never {
  throw new HTTPException(404, { message: "Registro no encontrado" });
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

  const texto = c.req.query("baseVersion");
  const base = texto === undefined ? null : z.coerce.number().int().nonnegative().safeParse(texto);
  if (base !== null && !base.success) {
    throw new HTTPException(422, { message: "baseVersion debe ser un entero" });
  }
  const resultado = await borrarPrueba(id, base?.data ?? null);
  if (resultado.tipo === "conflicto") return conflicto(c, resultado.actual);
  if (resultado.tipo === "inexistente") return inexistente();
  await recordarResultado(clave, 204, null);
  return c.body(null, 204);
}
