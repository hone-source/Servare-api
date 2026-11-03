import { MongoServerError } from "mongodb";
import { db } from "../config/db.ts";
import type { Prueba } from "../models/prueba.ts";

// _id es el entityId (UUID) que genera la app; createdAt es el de la app (ms desde epoch).
// version empieza en 1 y sube con cada cambio
type PruebaDoc = Prueba & { _id: string; version: number; updatedAt: Date };

const pruebas = db.collection<PruebaDoc>("pruebas");

const CODIGO_CLAVE_DUPLICADA = 11000;

export type PruebaVista = Prueba & { entityId: string; version: number };

function vista(doc: PruebaDoc): PruebaVista {
  const { _id, titulo, texto, numero, createdAt, version } = doc;
  return { entityId: _id, titulo, texto, numero, createdAt, version };
}

export async function listarPruebas(): Promise<PruebaVista[]> {
  const docs = await pruebas.find().sort({ createdAt: -1 }).toArray();
  return docs.map(vista);
}

export type ResultadoGuardadoPrueba =
  | { tipo: "creada" | "actualizada"; prueba: PruebaVista }
  | { tipo: "conflicto"; actual: PruebaVista } // la versión del servidor es otra
  | { tipo: "inexistente" };

// Crea el registro con versión 1. Si ya existe es un conflicto: el reintento de una operación ya
// aplicada se resuelve antes, con su clave de idempotencia
export async function crearPrueba(id: string, prueba: Prueba): Promise<ResultadoGuardadoPrueba> {
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
): Promise<ResultadoGuardadoPrueba> {
  const actual = await pruebas.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (actual.version !== baseVersion) return { tipo: "conflicto", actual: vista(actual) };

  // El filtro por versión evita pisar un cambio que llegó entre la lectura y la escritura
  const nueva = await pruebas.findOneAndUpdate(
    { _id: id, version: baseVersion },
    { $set: { ...prueba, version: baseVersion + 1, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (nueva) return { tipo: "actualizada", prueba: vista(nueva) };
  return actualizarPrueba(id, prueba, baseVersion); // otro cambio ganó: se evalúa de nuevo
}

export type ResultadoBorradoPrueba =
  | { tipo: "borrada" | "inexistente" }
  | { tipo: "conflicto"; actual: PruebaVista };

// baseVersion vacía borra sin comprobar la versión
export async function borrarPrueba(
  id: string,
  baseVersion: number | null,
): Promise<ResultadoBorradoPrueba> {
  const actual = await pruebas.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (baseVersion !== null && actual.version !== baseVersion) {
    return { tipo: "conflicto", actual: vista(actual) };
  }
  const res = await pruebas.deleteOne({ _id: id, version: actual.version });
  return res.deletedCount > 0 ? { tipo: "borrada" } : borrarPrueba(id, baseVersion);
}
