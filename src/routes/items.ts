import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";

// Recurso de ejemplo con almacenamiento en memoria; reemplazar por una base de datos real.
interface Item {
  id: string;
  name: string;
  createdAt: string;
}

const store = new Map<string, Item>();

async function readName(req: Request): Promise<string> {
  const body = await req.json().catch(() => null);
  const name = body?.name;
  if (typeof name !== "string" || name.trim() === "") {
    throw new HTTPException(400, { message: "'name' es obligatorio" });
  }
  return name.trim();
}

function findItem(id: string): Item {
  const item = store.get(id);
  if (!item) throw new HTTPException(404, { message: "Item no encontrado" });
  return item;
}

export const items = new Hono();

items.get("/", (c) => c.json([...store.values()]));

items.get("/:id", (c) => c.json(findItem(c.req.param("id"))));

items.post("/", async (c) => {
  const item: Item = {
    id: crypto.randomUUID(),
    name: await readName(c.req.raw),
    createdAt: new Date().toISOString(),
  };
  store.set(item.id, item);
  return c.json(item, 201);
});

items.put("/:id", async (c) => {
  const item = findItem(c.req.param("id"));
  item.name = await readName(c.req.raw);
  return c.json(item);
});

items.delete("/:id", (c) => {
  findItem(c.req.param("id"));
  store.delete(c.req.param("id"));
  return c.body(null, 204);
});
