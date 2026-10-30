import { MongoServerError } from "mongodb";
import { db } from "../config/db.ts";
import { hashearContrasena, verificarContrasena } from "../utils/contrasena.ts";

// _id es un UUID generado aquí. claveRegistro es la del intento de registro que creó la cuenta
type UsuarioDoc = {
  _id: string;
  correo: string;
  hash: string;
  claveRegistro: string;
  creadoEn: Date;
};

const usuarios = db.collection<UsuarioDoc>("usuarios");

const CODIGO_CLAVE_DUPLICADA = 11000;

export type ResultadoRegistro =
  | { tipo: "creado" | "repetido"; id: string; correo: string }
  | { tipo: "correo_registrado" };

// Crea la cuenta. Si el correo ya existe pero el intento es el mismo (misma clave y misma
// contraseña), es un reintento de la app: se responde como la primera vez ("repetido")
export async function registrarUsuario(
  correo: string,
  contrasena: string,
  claveRegistro: string,
): Promise<ResultadoRegistro> {
  const doc: UsuarioDoc = {
    _id: crypto.randomUUID(),
    correo,
    hash: await hashearContrasena(contrasena),
    claveRegistro,
    creadoEn: new Date(),
  };
  try {
    await usuarios.insertOne(doc);
    return { tipo: "creado", id: doc._id, correo };
  } catch (err) {
    if (!(err instanceof MongoServerError) || err.code !== CODIGO_CLAVE_DUPLICADA) throw err;
  }

  const existente = await usuarios.findOne({ correo });
  if (
    existente && existente.claveRegistro === claveRegistro &&
    await verificarContrasena(contrasena, existente.hash)
  ) {
    return { tipo: "repetido", id: existente._id, correo };
  }
  return { tipo: "correo_registrado" };
}

// Hash de relleno: si el correo no existe se verifica igual una contraseña, así el tiempo de
// respuesta no delata qué correos tienen cuenta
let hashRelleno: Promise<string> | undefined;

// null si el correo no existe o la contraseña no coincide: la app no debe poder distinguirlos
export async function autenticarUsuario(
  correo: string,
  contrasena: string,
): Promise<{ id: string; correo: string } | null> {
  const usuario = await usuarios.findOne({ correo });
  const hash = usuario?.hash ?? await (hashRelleno ??= hashearContrasena(crypto.randomUUID()));
  const coincide = await verificarContrasena(contrasena, hash);
  return usuario && coincide ? { id: usuario._id, correo: usuario.correo } : null;
}
