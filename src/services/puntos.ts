import { MongoServerError } from "mongodb";
import { db } from "../config/db.ts";
import type { Punto } from "../models/punto.ts";

// _id es el entityId (UUID) que genera la app; createdAt es el de la app (ms desde epoch).
// version empieza en 1 y sube con cada cambio
type PuntoDoc = Punto & { _id: string; version: number; updatedAt: Date };

const puntos = db.collection<PuntoDoc>("puntos");

const CODIGO_CLAVE_DUPLICADA = 11000;

export type PuntoVista = Punto & { entityId: string; version: number };

function vista(doc: PuntoDoc): PuntoVista {
  const { _id, nombre, latitud, longitud, createdAt, version } = doc;
  return { entityId: _id, nombre, latitud, longitud, createdAt, version };
}

export async function listarPuntos(): Promise<PuntoVista[]> {
  const docs = await puntos.find().sort({ createdAt: -1 }).toArray();
  return docs.map(vista);
}

export type ResultadoGuardadoPunto =
  | { tipo: "creado" | "actualizado"; punto: PuntoVista }
  | { tipo: "conflicto"; actual: PuntoVista } // la versión del servidor es otra
  | { tipo: "inexistente" };

// Crea el punto con versión 1. Si ya existe es un conflicto: el reintento de una operación ya
// aplicada se resuelve antes, con su clave de idempotencia
export async function crearPunto(id: string, punto: Punto): Promise<ResultadoGuardadoPunto> {
  const doc: PuntoDoc = { _id: id, ...punto, version: 1, updatedAt: new Date() };
  try {
    await puntos.insertOne(doc);
    return { tipo: "creado", punto: vista(doc) };
  } catch (err) {
    if (!(err instanceof MongoServerError) || err.code !== CODIGO_CLAVE_DUPLICADA) throw err;
  }
  const actual = await puntos.findOne({ _id: id });
  // Si lo borraron entre el intento y la lectura, se vuelve a intentar
  return actual ? { tipo: "conflicto", actual: vista(actual) } : crearPunto(id, punto);
}

// Solo actualiza si el punto sigue en baseVersion; si no, devuelve el vigente para que la app decida
export async function actualizarPunto(
  id: string,
  punto: Punto,
  baseVersion: number,
): Promise<ResultadoGuardadoPunto> {
  const actual = await puntos.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (actual.version !== baseVersion) return { tipo: "conflicto", actual: vista(actual) };

  // El filtro por versión evita pisar un cambio que llegó entre la lectura y la escritura
  const nuevo = await puntos.findOneAndUpdate(
    { _id: id, version: baseVersion },
    { $set: { ...punto, version: baseVersion + 1, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (nuevo) return { tipo: "actualizado", punto: vista(nuevo) };
  return actualizarPunto(id, punto, baseVersion); // otro cambio ganó: se evalúa de nuevo
}

export type ResultadoBorradoPunto =
  | { tipo: "borrado" | "inexistente" }
  | { tipo: "conflicto"; actual: PuntoVista };

// baseVersion vacía borra sin comprobar la versión
export async function borrarPunto(
  id: string,
  baseVersion: number | null,
): Promise<ResultadoBorradoPunto> {
  const actual = await puntos.findOne({ _id: id });
  if (!actual) return { tipo: "inexistente" };
  if (baseVersion !== null && actual.version !== baseVersion) {
    return { tipo: "conflicto", actual: vista(actual) };
  }
  const res = await puntos.deleteOne({ _id: id, version: actual.version });
  return res.deletedCount > 0 ? { tipo: "borrado" } : borrarPunto(id, baseVersion);
}
