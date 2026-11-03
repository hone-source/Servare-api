import { MongoServerError } from "mongodb";
import { db } from "../config/db.ts";
import type { Ficha } from "../models/ficha.ts";

// _id es el entityId (UUID) que genera la app; createdAt es el de la app (ms desde epoch).
// version empieza en 1 y sube con cada cambio
type FichaDoc = Ficha & { _id: string; version: number; updatedAt: Date };

const fichas = db.collection<FichaDoc>("fichas");

const CODIGO_CLAVE_DUPLICADA = 11000;

export type FichaVista = Ficha & { entityId: string; version: number };

function vista(doc: FichaDoc): FichaVista {
  const { _id, datos, createdAt, version } = doc;
  return { entityId: _id, datos, createdAt, version };
}

export async function listarFichas(): Promise<FichaVista[]> {
  const docs = await fichas.find().sort({ createdAt: -1 }).toArray();
  return docs.map(vista);
}

export type ResultadoGuardadoFicha =
  | { tipo: "creada" | "actualizada"; ficha: FichaVista }
  | { tipo: "conflicto"; actual: FichaVista } // la versión del servidor es otra
  | { tipo: "inexistente" };

// Crea la ficha con versión 1. Si ya existe es un conflicto: el reintento de una operación ya
// aplicada se resuelve antes, con su clave de idempotencia
export async function crearFicha(id: string, ficha: Ficha): Promise<ResultadoGuardadoFicha> {
  const doc: FichaDoc = { _id: id, ...ficha, version: 1, updatedAt: new Date() };
  try {
    await fichas.insertOne(doc);
    return { tipo: "creada", ficha: vista(doc) };
  } catch (err) {
    if (!(err instanceof MongoServerError) || err.code !== CODIGO_CLAVE_DUPLICADA) throw err;
  }
  const actual = await fichas.findOne({ _id: id });
  // Si la borraron entre el intento y la lectura, se vuelve a intentar
  return actual ? { tipo: "conflicto", actual: vista(actual) } : crearFicha(id, ficha);
}

// Solo actualiza si la ficha sigue en baseVersion; si no, devuelve la vigente para que la app decida
export async function actualizarFicha(
  id: string,
  ficha: Ficha,
  baseVersion: number,
): Promise<ResultadoGuardadoFicha> {
  const actual = await fichas.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (actual.version !== baseVersion) return { tipo: "conflicto", actual: vista(actual) };

  // El filtro por versión evita pisar un cambio que llegó entre la lectura y la escritura
  const nueva = await fichas.findOneAndUpdate(
    { _id: id, version: baseVersion },
    { $set: { ...ficha, version: baseVersion + 1, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (nueva) return { tipo: "actualizada", ficha: vista(nueva) };
  return actualizarFicha(id, ficha, baseVersion); // otro cambio ganó: se evalúa de nuevo
}

export type ResultadoBorradoFicha =
  | { tipo: "borrada" | "inexistente" }
  | { tipo: "conflicto"; actual: FichaVista };

// baseVersion vacía borra sin comprobar la versión
export async function borrarFicha(
  id: string,
  baseVersion: number | null,
): Promise<ResultadoBorradoFicha> {
  const actual = await fichas.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (baseVersion !== null && actual.version !== baseVersion) {
    return { tipo: "conflicto", actual: vista(actual) };
  }
  const res = await fichas.deleteOne({ _id: id, version: actual.version });
  return res.deletedCount > 0 ? { tipo: "borrada" } : borrarFicha(id, baseVersion);
}
