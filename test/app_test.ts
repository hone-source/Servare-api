// Integración con MongoDB: solo corre si MONGODB_URI está definida, p. ej.:
//   MONGODB_URI='mongodb://servare:servare@localhost:27017/servare?authSource=admin' deno task test
// Cada test usa ids propios (UUID), claves "test-…" y correos @test.servare, y al final se borran.
import { assert, assertEquals } from "@std/assert";
import { app } from "../src/app.ts";
import { HAY_BD, peticion, uuid } from "./helpers.ts";
import type { Opciones } from "./helpers.ts";

const ignore = !HAY_BD;
// El cliente de MongoDB es compartido y conecta de forma perezosa: se desactivan los sanitizers
const base = { ignore, sanitizeOps: false, sanitizeResources: false };

const idsPruebas: string[] = [];
const idsFichas: string[] = [];

const clave = () => `test-${uuid()}`;
const p = (metodo: string, ruta: string, o: Opciones = {}) =>
  peticion(app, metodo, ruta, { clave: clave(), ...o });

const prueba = (extra: Record<string, unknown> = {}) => ({
  titulo: "t",
  texto: "x",
  numero: 1,
  createdAt: 1790000000000,
  ...extra,
});

async function crearPrueba(extra: Record<string, unknown> = {}) {
  const id = uuid();
  idsPruebas.push(id);
  const res = await p("POST", `/api/pruebas/${id}`, { cuerpo: prueba(extra) });
  assertEquals(res.status, 201);
  return { id, cuerpo: await res.json() };
}

// ---------- Cuentas y sesión ----------

Deno.test({
  name: "registro y login: sesión, reintento idempotente y errores",
  ...base,
  async fn() {
    const correo = `${uuid()}@test.servare`;
    const cuerpo = { correo: correo.toUpperCase(), contrasena: "una-contraseña-larga" };
    const k = clave();
    const post = (ruta: string, c: unknown, key = k) =>
      app.request(`/api/auth/${ruta}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(c),
      });

    const creada = await post("registro", cuerpo);
    assertEquals(creada.status, 201);
    const sesion = await creada.json();
    assertEquals(sesion.correo, correo); // normalizado
    assert(sesion.expiraEn > Date.now());
    assertEquals(Object.keys(sesion).sort(), ["correo", "expiraEn", "token"]); // sin hash

    // Reintento de la app: misma clave y contraseña → 200, no un 409 contra uno mismo
    assertEquals((await post("registro", cuerpo)).status, 200);
    // Otro intento (otra clave) con el mismo correo → 409; misma clave y otra contraseña → 409
    assertEquals((await post("registro", cuerpo, clave())).status, 409);
    assertEquals(
      (await post("registro", { ...cuerpo, contrasena: "otra-contraseña" })).status,
      409,
    );

    // Login
    const ok = await post("login", { correo, contrasena: "una-contraseña-larga" });
    assertEquals(ok.status, 200);
    const { token } = await ok.json();
    // El token del login sirve en rutas protegidas
    assertEquals((await p("GET", "/api/pruebas", { token })).status, 200);

    // Contraseña errónea y correo inexistente: misma respuesta, sin decir cuál falló
    const mala = await post("login", { correo, contrasena: "incorrecta" });
    const inexistente = await post("login", { correo: `${uuid()}@test.servare`, contrasena: "x" });
    assertEquals(mala.status, 401);
    assertEquals(inexistente.status, 401);
    assertEquals(await mala.json(), await inexistente.json());
  },
});

// ---------- Pruebas: versiones, idempotencia, conflictos ----------

Deno.test({
  name: "pruebas: crear devuelve versión 1, se lista y un duplicado es 409 con el vigente",
  ...base,
  async fn() {
    const { id, cuerpo } = await crearPrueba({ titulo: "primera" });
    assertEquals(cuerpo, {
      entityId: id,
      titulo: "primera",
      texto: "x",
      numero: 1,
      createdAt: 1790000000000,
      version: 1,
    });

    const lista = await (await p("GET", "/api/pruebas")).json();
    assertEquals(lista.find((x: { entityId: string }) => x.entityId === id), cuerpo);

    const dup = await p("POST", `/api/pruebas/${id}`, { cuerpo: prueba({ titulo: "otra" }) });
    assertEquals(dup.status, 409);
    const dupCuerpo = await dup.json();
    assertEquals(dupCuerpo.error, "El registro cambió en el servidor");
    assertEquals(dupCuerpo.actual, cuerpo);
  },
});

Deno.test({
  name: "pruebas: el listado va de la más reciente a la más antigua por createdAt",
  ...base,
  async fn() {
    const vieja = await crearPrueba({ createdAt: 1 });
    const nueva = await crearPrueba({ createdAt: 2 ** 40 });
    const ids = (await (await p("GET", "/api/pruebas")).json())
      .map((x: { entityId: string }) => x.entityId);
    assert(ids.indexOf(nueva.id) < ids.indexOf(vieja.id));
  },
});

Deno.test({
  name: "pruebas: mismo Idempotency-Key devuelve lo mismo y no vuelve a aplicar",
  ...base,
  async fn() {
    const id = uuid();
    idsPruebas.push(id);
    const k = clave();
    const a = await p("POST", `/api/pruebas/${id}`, { clave: k, cuerpo: prueba() });
    const b = await p("POST", `/api/pruebas/${id}`, { clave: k, cuerpo: prueba() });
    assertEquals(a.status, 201);
    assertEquals(b.status, 201); // no 409 contra uno mismo
    assertEquals(await b.json(), await a.json());

    const ku = clave();
    const u1 = await p("PUT", `/api/pruebas/${id}`, {
      clave: ku,
      cuerpo: prueba({ titulo: "v2", baseVersion: 1 }),
    });
    const u2 = await p("PUT", `/api/pruebas/${id}`, {
      clave: ku,
      cuerpo: prueba({ titulo: "v2", baseVersion: 1 }),
    });
    assertEquals(u1.status, 200);
    assertEquals(u2.status, 200);
    assertEquals((await u2.json()).version, 2); // no subió a 3

    const kd = clave();
    assertEquals((await p("DELETE", `/api/pruebas/${id}`, { clave: kd })).status, 204);
    // El reintento del borrado también es 204 (y no 404)
    assertEquals((await p("DELETE", `/api/pruebas/${id}`, { clave: kd })).status, 204);
  },
});

Deno.test({
  name: "pruebas: PUT sube la versión, y rechaza baseVersion ajena, ausente o registro inexistente",
  ...base,
  async fn() {
    const { id } = await crearPrueba();
    const ruta = `/api/pruebas/${id}`;

    const v2 = await p("PUT", ruta, { cuerpo: prueba({ titulo: "v2", baseVersion: 1 }) });
    assertEquals(v2.status, 200);
    const nueva = await v2.json();
    assertEquals([nueva.titulo, nueva.version], ["v2", 2]);

    // Editó sobre una versión vieja → 409 con el registro vigente
    const viejo = await p("PUT", ruta, { cuerpo: prueba({ titulo: "v?", baseVersion: 1 }) });
    assertEquals(viejo.status, 409);
    assertEquals((await viejo.json()).actual, nueva);

    // Sin baseVersion → 422 (también con null)
    assertEquals((await p("PUT", ruta, { cuerpo: prueba() })).status, 422);
    assertEquals((await p("PUT", ruta, { cuerpo: prueba({ baseVersion: null }) })).status, 422);

    // Cuerpo inválido → 400
    assertEquals((await p("PUT", ruta, { cuerpo: { titulo: "solo" } })).status, 400);

    // Registro inexistente → 404
    const fantasma = await p("PUT", `/api/pruebas/${uuid()}`, {
      cuerpo: prueba({ baseVersion: 1 }),
    });
    assertEquals(fantasma.status, 404);
  },
});

Deno.test({
  name: "pruebas: los rechazos no se guardan, así que se puede reintentar con la misma clave",
  ...base,
  async fn() {
    const id = uuid();
    idsPruebas.push(id);
    const k = clave();
    // 404 primero; después de crear el registro, la misma clave ya se aplica
    const antes = await p("PUT", `/api/pruebas/${id}`, {
      clave: k,
      cuerpo: prueba({ baseVersion: 1 }),
    });
    assertEquals(antes.status, 404);
    assertEquals((await p("POST", `/api/pruebas/${id}`, { cuerpo: prueba() })).status, 201);
    const despues = await p("PUT", `/api/pruebas/${id}`, {
      clave: k,
      cuerpo: prueba({ baseVersion: 1 }),
    });
    assertEquals(despues.status, 200);
  },
});

Deno.test({
  name: "pruebas: DELETE con baseVersion ajena es 409; sin baseVersion borra; luego 404",
  ...base,
  async fn() {
    const { id } = await crearPrueba();
    const ruta = `/api/pruebas/${id}`;

    const ajena = await p("DELETE", ruta, { consulta: "?baseVersion=7" });
    assertEquals(ajena.status, 409);
    assertEquals((await ajena.json()).actual.version, 1);

    assertEquals((await p("DELETE", ruta, { consulta: "?baseVersion=1" })).status, 204);
    assertEquals((await p("DELETE", ruta)).status, 404);

    const otra = await crearPrueba();
    assertEquals((await p("DELETE", `/api/pruebas/${otra.id}`)).status, 204); // sin comprobar versión
    const lista = await (await p("GET", "/api/pruebas")).json();
    assertEquals(lista.some((x: { entityId: string }) => x.entityId === otra.id), false);
  },
});

Deno.test({
  name: "pruebas: dos PUT simultáneos con la misma baseVersion → uno gana y el otro es 409",
  ...base,
  async fn() {
    const { id } = await crearPrueba();
    const envia = (titulo: string) =>
      p("PUT", `/api/pruebas/${id}`, { cuerpo: prueba({ titulo, baseVersion: 1 }) });
    const estados = (await Promise.all([envia("A"), envia("B"), envia("C")]))
      .map((r) => r.status).sort();
    assertEquals(estados, [200, 409, 409]);

    const lista = await (await p("GET", "/api/pruebas")).json();
    assertEquals(lista.find((x: { entityId: string }) => x.entityId === id).version, 2);
  },
});

// ---------- Fichas ----------

Deno.test({
  name: "fichas: ciclo crear, listar, actualizar, conflicto y borrar",
  ...base,
  async fn() {
    const id = uuid();
    idsFichas.push(id);
    const ruta = `/api/fichas/${id}`;
    const datos = {
      pueblo: "WIXARIKA",
      nombre: "Tukipa de prueba",
      tipoEspacio: "TUKIPA",
      fechaLevantamiento: "2026-10-21",
      horaInicio: "09:30",
      poligonal: [{ puntoReferencia: "A" }, { puntoReferencia: "B" }],
      rituales: [{ tipo: "FIESTA", nombres: "Fiesta del maíz" }],
    };

    const creada = await p("POST", ruta, { cuerpo: { datos, createdAt: 1790000000000 } });
    assertEquals(creada.status, 201);
    const c = await creada.json();
    assertEquals([c.entityId, c.version, c.createdAt], [id, 1, 1790000000000]);
    assertEquals(c.datos.nombre, "Tukipa de prueba");
    assertEquals(c.datos.comunidad, ""); // lo omitido se guarda vacío
    assertEquals(c.datos.elementos, []);
    assertEquals(c.datos.poligonal.map((x: { puntoReferencia: string }) => x.puntoReferencia), [
      "A",
      "B",
    ]);

    const lista = await (await p("GET", "/api/fichas")).json();
    assertEquals(lista.find((f: { entityId: string }) => f.entityId === id), c);

    assertEquals((await p("POST", ruta, { cuerpo: { datos, createdAt: 1 } })).status, 409);

    const act = await p("PUT", ruta, {
      cuerpo: {
        datos: { ...datos, nombre: "Renombrada", poligonal: [] },
        createdAt: 1790000000000,
        baseVersion: 1,
      },
    });
    assertEquals(act.status, 200);
    const a = await act.json();
    assertEquals([a.version, a.datos.nombre, a.datos.poligonal], [2, "Renombrada", []]);

    const viejo = await p("PUT", ruta, {
      cuerpo: { datos, createdAt: 1790000000000, baseVersion: 1 },
    });
    assertEquals(viejo.status, 409);
    assertEquals((await viejo.json()).actual.version, 2);

    assertEquals((await p("PUT", ruta, { cuerpo: { datos, createdAt: 1 } })).status, 422);
    assertEquals(
      (await p("POST", `/api/fichas/${uuid()}`, {
        cuerpo: { datos: { pueblo: "X" }, createdAt: 1 },
      })).status,
      400,
    );

    assertEquals((await p("DELETE", ruta, { consulta: "?baseVersion=1" })).status, 409);
    assertEquals((await p("DELETE", ruta, { consulta: "?baseVersion=2" })).status, 204);
    assertEquals((await p("DELETE", ruta)).status, 404);
  },
});

// Limpia lo que crearon los tests y cierra el cliente compartido, una sola vez y al final
Deno.test({
  name: "limpia los datos de prueba y cierra la conexión a la base de datos",
  ...base,
  async fn() {
    const { db, client } = await import("../src/config/db.ts");
    try {
      await db.collection("pruebas").deleteMany({ _id: { $in: idsPruebas } as never });
      await db.collection("fichas").deleteMany({ _id: { $in: idsFichas } as never });
      await db.collection("operaciones").deleteMany({ _id: /^test-/ as never });
      await db.collection("usuarios").deleteMany({ correo: /@test\.servare$/ });
    } finally {
      await client.close();
    }
  },
});
