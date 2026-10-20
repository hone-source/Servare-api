import { assertEquals } from "@std/assert";
import { app } from "./app.ts";

Deno.test("GET /health responde ok", async () => {
  const res = await app.request("/health");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "ok" });
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
