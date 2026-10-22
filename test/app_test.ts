import { assertEquals } from "@std/assert";
import { app } from "../src/app.ts";

for (const path of ["/health", "/api/v1/health"]) {
  Deno.test(`GET ${path} responde ok sin caché`, async () => {
    const res = await app.request(path);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Cache-Control"), "no-store");
    const body = await res.json();
    assertEquals(body.status, "ok");
    assertEquals(Number.isNaN(Date.parse(body.time)), false);
  });
}

Deno.test("HEAD /api/v1/health responde 200 sin cuerpo", async () => {
  const res = await app.request("/api/v1/health", { method: "HEAD" });
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "");
});

Deno.test("ruta inexistente devuelve 404 en JSON", async () => {
  const res = await app.request("/no-existe");
  assertEquals(res.status, 404);
  assertEquals(await res.json(), { error: "Not Found" });
});

Deno.test("CRUD de items", async () => {
  const created = await app.request("/api/v1/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "primero" }),
  });
  assertEquals(created.status, 201);
  const { id } = await created.json();

  const fetched = await app.request(`/api/v1/items/${id}`);
  assertEquals((await fetched.json()).name, "primero");

  const updated = await app.request(`/api/v1/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "renombrado" }),
  });
  assertEquals((await updated.json()).name, "renombrado");

  const deleted = await app.request(`/api/v1/items/${id}`, { method: "DELETE" });
  assertEquals(deleted.status, 204);

  const missing = await app.request(`/api/v1/items/${id}`);
  assertEquals(missing.status, 404);
});

Deno.test("POST sin name devuelve 400", async () => {
  const res = await app.request("/api/v1/items", { method: "POST", body: "{}" });
  assertEquals(res.status, 400);
});

const putFicha = (id: string, ficha: unknown) =>
  app.request(`/api/v1/fichas/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ficha),
  });

Deno.test("PUT de ficha con id que no es UUID devuelve 400", async () => {
  const res = await putFicha("123", {});
  assertEquals(res.status, 400);
});

Deno.test("PUT de ficha con enum o fecha inválidos devuelve 400", async () => {
  const id = crypto.randomUUID();
  assertEquals((await putFicha(id, { pueblo: "OTRO" })).status, 400);
  assertEquals((await putFicha(id, { fechaLevantamiento: "21/10/2026" })).status, 400);
  assertEquals((await putFicha(id, { rituales: [{ tipo: "BAILE" }] })).status, 400);
});

// Requiere Postgres con el esquema de db/init, p. ej.:
//   DATABASE_URL=postgres://servare:servare@localhost:5432/servare deno task test
Deno.test({
  name: "CRUD de fichas en la base de datos",
  ignore: !Deno.env.get("DATABASE_URL"),
  async fn() {
    const { sql } = await import("../src/config/db.ts");
    const id = crypto.randomUUID();
    try {
      const ficha = {
        pueblo: "WIXARIKA",
        nombre: "Tukipa de prueba",
        tipoEspacio: "TUKIPA",
        comunidad: "San Andrés",
        fechaLevantamiento: "2026-10-21",
        horaInicio: "09:30",
        fotografias: { cantidad: "12", desde: "001", hasta: "012" },
        poligonal: [{ puntoReferencia: "A" }, { puntoReferencia: "B" }],
        rituales: [{ tipo: "FIESTA", nombres: "Fiesta del maíz" }],
        participantes: [{ cargo: "Comisariado", nombre: "Persona" }],
      };

      const creada = await putFicha(id, ficha);
      assertEquals(creada.status, 201);

      const leida = await (await app.request(`/api/v1/fichas/${id}`)).json();
      assertEquals(leida.pueblo, "WIXARIKA");
      assertEquals(leida.fechaLevantamiento, "2026-10-21");
      assertEquals(leida.horaInicio, "09:30:00");
      assertEquals(leida.fotografias, { cantidad: "12", desde: "001", hasta: "012" });
      assertEquals(leida.grabaciones, { cantidad: "", desde: "", hasta: "" });
      assertEquals(leida.poligonal.map((p: { puntoReferencia: string }) => p.puntoReferencia), [
        "A",
        "B",
      ]);
      assertEquals(leida.rituales[0].tipoOtro, "");
      assertEquals(leida.elementos, []);

      const actualizada = await putFicha(id, { ...ficha, nombre: "Renombrada", poligonal: [] });
      assertEquals(actualizada.status, 200);
      const releida = await (await app.request(`/api/v1/fichas/${id}`)).json();
      assertEquals(releida.nombre, "Renombrada");
      assertEquals(releida.poligonal, []);
      assertEquals(releida.participantes.length, 1);

      const lista = await (await app.request("/api/v1/fichas")).json();
      assertEquals(lista.find((f: { entityId: string }) => f.entityId === id), {
        entityId: id,
        nombre: "Renombrada",
        tipoEspacio: "TUKIPA",
        comunidad: "San Andrés",
        fechaLevantamiento: "2026-10-21",
      });

      const borrada = await app.request(`/api/v1/fichas/${id}`, { method: "DELETE" });
      assertEquals(borrada.status, 204);
      assertEquals((await app.request(`/api/v1/fichas/${id}`)).status, 404);
      assertEquals((await sql`select 1 from ficha_rituales where ficha_id = ${id}`).length, 0);
    } finally {
      await sql`delete from fichas where id = ${id}`;
      await sql.end();
    }
  },
});
