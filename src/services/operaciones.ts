import { MongoServerError } from "mongodb";
import { db } from "../config/db.ts";

// Resultado de una operación que ya se aplicó: un reintento con la misma clave recibe lo mismo.
// Es común a todos los recursos que la app sincroniza (la clave es un UUID único por operación)
type OperacionDoc = { _id: string; estado: number; cuerpo: unknown; creadoEn: Date };

const operaciones = db.collection<OperacionDoc>("operaciones");

const CODIGO_CLAVE_DUPLICADA = 11000;

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
