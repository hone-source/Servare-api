import type { MiddlewareHandler } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { verify } from "@hono/hono/jwt";
import { secretoJwt } from "../config/auth.ts";

// Exige el token de sesión en Authorization: Bearer. 401 si falta, es inválido o expiró.
// La app lo toma como "sesión expirada": pausa su cola y pide iniciar sesión, no marca las operaciones como fallidas
export const autenticacion: MiddlewareHandler = async (c, next) => {
  const cabecera = c.req.header("Authorization");
  const token = cabecera?.startsWith("Bearer ") ? cabecera.slice(7).trim() : "";
  if (!token) throw new HTTPException(401, { message: "Falta iniciar sesión" });

  // Fuera del try: un servidor sin secreto es un error del servidor (500), no un 401 del usuario
  const secreto = secretoJwt();
  try {
    await verify(token, secreto, "HS256");
  } catch {
    throw new HTTPException(401, { message: "La sesión no es válida o expiró" });
  }
  await next();
};
