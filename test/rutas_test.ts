// Rutas que se resuelven sin tocar MongoDB: no necesitan base de datos
import { assertEquals, assertNotEquals } from "@std/assert";
import { app } from "../src/app.ts";
import { JWT_SECRET, peticion, token, uuid } from "./helpers.ts";

Deno.test("GET /api/healthcheck responde ok sin caché ni sesión", async () => {
  const res = await app.request("/api/healthcheck");
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Cache-Control"), "no-store");
  const body = await res.json();
  assertEquals(body.status, "ok");
  assertEquals(Number.isNaN(Date.parse(body.time)), false);
});

Deno.test("ruta inexistente devuelve 404 en JSON", async () => {
  const res = await app.request("/no-existe");
  assertEquals(res.status, 404);
  assertEquals(await res.json(), { error: "Not Found" });
});

Deno.test("las respuestas llevan cabeceras seguras y CORS en /api", async () => {
  const res = await app.request("/api/healthcheck", { headers: { Origin: "https://ejemplo.org" } });
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
  assertNotEquals(res.headers.get("Access-Control-Allow-Origin"), null);
  await res.body?.cancel();
});

for (const recurso of ["fichas", "pruebas"]) {
  const ruta = `/api/${recurso}`;

  Deno.test(`${recurso}: sin token devuelve 401`, async () => {
    const res = await peticion(app, "GET", ruta, { token: null });
    assertEquals(res.status, 401);
    assertEquals((await res.json()).error, "Falta iniciar sesión");
  });

  Deno.test(`${recurso}: token mal firmado, malformado o vencido devuelve 401`, async () => {
    const invalidos = [
      await token({ secreto: "otro-secreto" }),
      "no.es.un-jwt",
      await token({ exp: Math.floor(Date.now() / 1000) - 10 }),
    ];
    for (const t of invalidos) {
      const res = await peticion(app, "GET", ruta, { token: t });
      assertEquals(res.status, 401);
      assertEquals((await res.json()).error, "La sesión no es válida o expiró");
    }
  });

  Deno.test(`${recurso}: Authorization sin Bearer devuelve 401`, async () => {
    const res = await app.request(ruta, { headers: { Authorization: await token() } });
    assertEquals(res.status, 401);
    await res.body?.cancel();
  });

  for (const metodo of ["POST", "PUT", "DELETE"]) {
    // Con token vigente: el 400 prueba además que pasó la autenticación sin llegar a la BD
    Deno.test(`${recurso}: ${metodo} con id que no es UUID devuelve 400`, async () => {
      const res = await peticion(app, metodo, `${ruta}/123`, { cuerpo: {} });
      assertEquals(res.status, 400);
      await res.body?.cancel();
    });

    Deno.test(`${recurso}: ${metodo} sin Idempotency-Key devuelve 422`, async () => {
      const res = await peticion(app, metodo, `${ruta}/${uuid()}`, { clave: null, cuerpo: {} });
      assertEquals(res.status, 422);
      assertEquals((await res.json()).error, "Falta la cabecera Idempotency-Key");
    });
  }

  Deno.test(`${recurso}: DELETE con baseVersion no entero devuelve 422`, async () => {
    for (const mala of ["abc", "-1", "1.5"]) {
      const res = await peticion(app, "DELETE", `${ruta}/${uuid()}`, {
        consulta: `?baseVersion=${mala}`,
      });
      assertEquals(res.status, 422, `baseVersion=${mala}`);
      await res.body?.cancel();
    }
  });
}

Deno.test("registro: sin Idempotency-Key devuelve 422", async () => {
  const res = await app.request("/api/auth/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo: "a@b.co", contrasena: "12345678" }),
  });
  assertEquals(res.status, 422);
  await res.body?.cancel();
});

Deno.test("registro y login: cuerpo inválido devuelve 422", async () => {
  const casos: [string, unknown][] = [
    ["registro", { correo: "no-correo", contrasena: "12345678" }],
    ["registro", { correo: "a@b.co", contrasena: "corta" }],
    ["login", { correo: "a@b.co" }],
    ["login", "no es json"],
  ];
  for (const [ruta, cuerpo] of casos) {
    const res = await app.request(`/api/auth/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": uuid() },
      body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    });
    assertEquals(res.status, 422, `${ruta} ${JSON.stringify(cuerpo)}`);
    await res.body?.cancel();
  }
});

Deno.test("sin JWT_SECRET, una ruta protegida responde 500 y no 401", async () => {
  Deno.env.delete("JWT_SECRET");
  try {
    const res = await app.request("/api/pruebas", { headers: { Authorization: "Bearer x" } });
    assertEquals(res.status, 500);
    assertEquals(await res.json(), { error: "Internal Server Error" });
  } finally {
    Deno.env.set("JWT_SECRET", JWT_SECRET);
  }
});
