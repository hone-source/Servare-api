import { MongoServerError } from "mongodb";
import { db } from "../config/db.ts";
import type { Prueba } from "../models/prueba.ts";

// _id es el entityId (UUID) que genera la app; createdAt es el de la app (ms desde epoch).
// version empieza en 1 y sube con cada cambio; los documentos anteriores a las versiones no la tienen (cuentan como 1)
type PruebaDoc = Prueba & { _id: string; version?: number; updatedAt: Date };

// Resultado de una operación que ya se aplicó: un reintento con la misma clave recibe lo mismo
type OperacionDoc = { _id: string; estado: number; cuerpo: unknown; creadoEn: Date };

const pruebas = db.collection<PruebaDoc>("pruebas");
const operaciones = db.collection<OperacionDoc>("operaciones");

const CODIGO_CLAVE_DUPLICADA = 11000;

export type PruebaVista = Prueba & { entityId: string; version: number };

function vista(doc: PruebaDoc): PruebaVista {
  const { _id, titulo, texto, numero, createdAt, version } = doc;
  return { entityId: _id, titulo, texto, numero, createdAt, version: version ?? 1 };
}

export async function listarPruebas(): Promise<PruebaVista[]> {
  const docs = await pruebas.find().sort({ createdAt: -1 }).toArray();
  return docs.map(vista);
}

export type ResultadoGuardado =
  | { tipo: "creada" | "actualizada"; prueba: PruebaVista }
  | { tipo: "conflicto"; actual: PruebaVista } // la versión del servidor es otra
  | { tipo: "inexistente" };

// Crea el registro con versión 1. Si ya existe es un conflicto: el reintento de una operación ya
// aplicada se resuelve antes, con su clave de idempotencia
export async function crearPrueba(id: string, prueba: Prueba): Promise<ResultadoGuardado> {
  const doc: PruebaDoc = { _id: id, ...prueba, version: 1, updatedAt: new Date() };
  try {
    await pruebas.insertOne(doc);
    return { tipo: "creada", prueba: vista(doc) };
  } catch (err) {
    if (!(err instanceof MongoServerError) || err.code !== CODIGO_CLAVE_DUPLICADA) throw err;
  }
  const actual = await pruebas.findOne({ _id: id });
  // Si lo borraron entre el intento y la lectura, se vuelve a intentar
  return actual ? { tipo: "conflicto", actual: vista(actual) } : crearPrueba(id, prueba);
}

// Solo actualiza si el registro sigue en baseVersion; si no, devuelve el vigente para que la app decida
export async function actualizarPrueba(
  id: string,
  prueba: Prueba,
  baseVersion: number,
): Promise<ResultadoGuardado> {
  const actual = await pruebas.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if ((actual.version ?? 1) !== baseVersion) return { tipo: "conflicto", actual: vista(actual) };

  // El filtro por versión evita pisar un cambio que llegó entre la lectura y la escritura
  const nuevo = await pruebas.findOneAndUpdate(
    { _id: id, version: actual.version ?? null } as Record<string, unknown>,
    { $set: { ...prueba, version: baseVersion + 1, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (nuevo) return { tipo: "actualizada", prueba: vista(nuevo) };
  return actualizarPrueba(id, prueba, baseVersion); // otro cambio ganó: se evalúa de nuevo
}

export type ResultadoBorrado =
  | { tipo: "borrada" | "inexistente" }
  | { tipo: "conflicto"; actual: PruebaVista };

// baseVersion vacía borra sin comprobar la versión
export async function borrarPrueba(
  id: string,
  baseVersion: number | null,
): Promise<ResultadoBorrado> {
  const actual = await pruebas.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (baseVersion !== null && (actual.version ?? 1) !== baseVersion) {
    return { tipo: "conflicto", actual: vista(actual) };
  }
  const res = await pruebas.deleteOne(
    { _id: id, version: actual.version ?? null } as Record<string, unknown>,
  );
  return res.deletedCount > 0 ? { tipo: "borrada" } : borrarPrueba(id, baseVersion);
}

export async function resultadoPrevio(clave: string) {
  return await operaciones.findOne({ _id: clave });
}

// Solo se guardan las operaciones aplicadas: un rechazo (404, 409) puede resolverse y reintentarse
export async function recordarResultado(clave: string, estado: number, cuerpo: unknown) {
  try {
    await operaciones.insertOne({ _id: clave, estado, cuerpo, creadoEn: new Date() });
  } catch (err) {
    if (!(err instanceof MongoServerError) || err.code !== CODIGO_CLAVE_DUPLICADA) throw err;
  }
}
