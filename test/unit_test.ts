// Unitarias: funciones puras y esquemas Zod, sin red ni base de datos
import { assert, assertEquals, assertFalse } from "@std/assert";
import { hashearContrasena, verificarContrasena } from "../src/utils/contrasena.ts";
import { Credenciales, Registro } from "../src/models/usuario.ts";
import { Prueba, PruebaEnvio } from "../src/models/prueba.ts";
import { FichaEnvio } from "../src/models/ficha.ts";
import { ClaveOperacion } from "../src/models/operacion.ts";

Deno.test("contraseña: el hash verifica la correcta y rechaza otra", async () => {
  const hash = await hashearContrasena("una-contraseña-larga");
  assert(hash.startsWith("pbkdf2$600000$"));
  assert(await verificarContrasena("una-contraseña-larga", hash));
  assertFalse(await verificarContrasena("otra-contraseña", hash));
});

Deno.test("contraseña: dos hashes de la misma contraseña difieren (sal aleatoria)", async () => {
  assert(await hashearContrasena("igual-igual") !== await hashearContrasena("igual-igual"));
});

Deno.test("contraseña: un hash guardado con formato inválido no verifica", async () => {
  assertFalse(await verificarContrasena("x", ""));
  assertFalse(await verificarContrasena("x", "bcrypt$1$a$b"));
  assertFalse(await verificarContrasena("x", "pbkdf2$600000$"));
});

Deno.test("Registro: normaliza el correo y exige 8 a 128 caracteres", () => {
  const ok = Registro.parse({ correo: "  Persona@Ejemplo.ORG ", contrasena: "12345678" });
  assertEquals(ok.correo, "persona@ejemplo.org");
  assertFalse(Registro.safeParse({ correo: "a@b.co", contrasena: "1234567" }).success);
  assertFalse(Registro.safeParse({ correo: "a@b.co", contrasena: "x".repeat(129) }).success);
  assert(Registro.safeParse({ correo: "a@b.co", contrasena: "x".repeat(128) }).success);
  assertFalse(Registro.safeParse({ correo: "no-es-correo", contrasena: "12345678" }).success);
});

Deno.test("Credenciales: acepta contraseñas cortas pero no vacías", () => {
  assert(Credenciales.safeParse({ correo: "a@b.co", contrasena: "1" }).success);
  assertFalse(Credenciales.safeParse({ correo: "a@b.co", contrasena: "" }).success);
});

Deno.test("ClaveOperacion: de 1 a 100 caracteres", () => {
  assertFalse(ClaveOperacion.safeParse("").success);
  assertFalse(ClaveOperacion.safeParse(undefined).success);
  assert(ClaveOperacion.safeParse("x".repeat(100)).success);
  assertFalse(ClaveOperacion.safeParse("x".repeat(101)).success);
});

Deno.test("Prueba: numero es int32 y createdAt entero no negativo", () => {
  const base = { titulo: "t", texto: "x", numero: 1, createdAt: 0 };
  assert(Prueba.safeParse(base).success);
  assertFalse(Prueba.safeParse({ ...base, numero: 2 ** 31 }).success);
  assertFalse(Prueba.safeParse({ ...base, numero: 1.5 }).success);
  assertFalse(Prueba.safeParse({ ...base, createdAt: -1 }).success);
  assertFalse(Prueba.safeParse({ ...base, titulo: undefined }).success);
});

Deno.test("PruebaEnvio: baseVersion es opcional, nula o entero no negativo", () => {
  const base = { titulo: "t", texto: "x", numero: 1, createdAt: 0 };
  assert(PruebaEnvio.safeParse(base).success);
  assert(PruebaEnvio.safeParse({ ...base, baseVersion: null }).success);
  assert(PruebaEnvio.safeParse({ ...base, baseVersion: 3 }).success);
  assertFalse(PruebaEnvio.safeParse({ ...base, baseVersion: -1 }).success);
  assertFalse(PruebaEnvio.safeParse({ ...base, baseVersion: "1" }).success);
});

Deno.test("FichaEnvio: textos y listas omitidos quedan vacíos", () => {
  const r = FichaEnvio.parse({ datos: {}, createdAt: 1 });
  assertEquals(r.datos.nombre, "");
  assertEquals(r.datos.poligonal, []);
});

Deno.test("FichaEnvio: rechaza enums, fechas y horas inválidos", () => {
  const con = (datos: unknown) => FichaEnvio.safeParse({ datos, createdAt: 1 }).success;
  assert(con({ pueblo: "WIXARIKA", fechaLevantamiento: "2026-10-21", horaInicio: "09:30" }));
  assertFalse(con({ pueblo: "OTRO" }));
  assertFalse(con({ fechaLevantamiento: "21/10/2026" }));
  assertFalse(con({ horaInicio: "25:00" }));
  assertFalse(con({ rituales: [{ tipo: "BAILE" }] }));
});
