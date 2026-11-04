import { sign } from "@hono/hono/jwt";

// Secreto fijo para los tests: así no dependen del entorno de quien los corre
export const JWT_SECRET = "secreto-solo-para-tests";
Deno.env.set("JWT_SECRET", JWT_SECRET);

export const HAY_BD = !!Deno.env.get("MONGODB_URI");

export function uuid(): string {
  return crypto.randomUUID();
}

// Token firmado como el de /api/auth; por defecto vigente una hora
export async function token(opciones: { secreto?: string; exp?: number } = {}): Promise<string> {
  const exp = opciones.exp ?? Math.floor(Date.now() / 1000) + 3600;
  return await sign({ sub: uuid(), exp }, opciones.secreto ?? JWT_SECRET, "HS256");
}

export type Opciones = {
  token?: string | null; // null: sin cabecera Authorization
  clave?: string | null; // Idempotency-Key; null: sin cabecera
  cuerpo?: unknown;
  consulta?: string;
};

type ConRequest = { request: (u: string, i?: RequestInit) => Response | Promise<Response> };

// Petición a un recurso sincronizable (fichas, pruebas) con sesión e idempotencia por defecto
export async function peticion(
  app: ConRequest,
  metodo: string,
  ruta: string,
  o: Opciones = {},
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = o.token === undefined ? await token() : o.token;
  if (t !== null) headers["Authorization"] = `Bearer ${t}`;
  const clave = o.clave === undefined ? uuid() : o.clave;
  if (clave !== null) headers["Idempotency-Key"] = clave;
  return await app.request(ruta + (o.consulta ?? ""), {
    method: metodo,
    headers,
    body: o.cuerpo === undefined ? undefined : JSON.stringify(o.cuerpo),
  });
}
