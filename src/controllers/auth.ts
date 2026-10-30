import type { Context } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { sign } from "@hono/hono/jwt";
import { z } from "zod";
import { secretoJwt } from "../config/auth.ts";
import { ClaveRegistro, Credenciales, Registro } from "../models/usuario.ts";
import { autenticarUsuario, registrarUsuario } from "../services/usuarios.ts";

// Pensado para trabajo de campo largo sin red: la sesión no debería caducar a mitad de un levantamiento
const VIGENCIA_TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

// Cuerpo JSON validado con su esquema, o 422
async function leerCuerpo<T>(c: Context, esquema: z.ZodType<T>): Promise<T> {
  const body = await c.req.json().catch(() => null);
  const result = esquema.safeParse(body);
  if (!result.success) {
    throw new HTTPException(422, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

// El token devuelto es nuevo en cada respuesta
async function responderSesion(
  c: Context,
  secreto: string,
  usuario: { id: string; correo: string },
  estado: 200 | 201,
) {
  const expiraEn = Date.now() + VIGENCIA_TOKEN_MS;
  const token = await sign(
    { sub: usuario.id, exp: Math.floor(expiraEn / 1000) },
    secreto,
    "HS256",
  );
  return c.json({ token, expiraEn, correo: usuario.correo }, estado);
}

// 201 cuenta nueva, 200 reintento del mismo registro, 409 si el correo es de otra cuenta
export async function registrar(c: Context) {
  const clave = ClaveRegistro.safeParse(c.req.header("Idempotency-Key"));
  if (!clave.success) {
    throw new HTTPException(422, { message: "Falta la cabecera Idempotency-Key" });
  }
  const { correo, contrasena } = await leerCuerpo(c, Registro);
  // Antes de crear la cuenta: un servidor mal configurado no debe dejar cuentas sin token
  const secreto = secretoJwt();
  const resultado = await registrarUsuario(correo, contrasena, clave.data);
  if (resultado.tipo === "correo_registrado") {
    throw new HTTPException(409, { message: "El correo ya está registrado" });
  }
  return responderSesion(c, secreto, resultado, resultado.tipo === "creado" ? 201 : 200);
}

// 200 con la sesión, 401 si el correo o la contraseña no son correctos (sin decir cuál)
export async function iniciarSesion(c: Context) {
  const { correo, contrasena } = await leerCuerpo(c, Credenciales);
  const secreto = secretoJwt();
  const usuario = await autenticarUsuario(correo, contrasena);
  if (!usuario) {
    throw new HTTPException(401, { message: "Correo o contraseña incorrectos" });
  }
  return responderSesion(c, secreto, usuario, 200);
}
