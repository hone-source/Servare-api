import { Hono } from "@hono/hono";
import { borrar, guardar, listar, obtener } from "../controllers/fichas.ts";

export const fichas = new Hono();

fichas.get("/", listar);
fichas.get("/:id", obtener);
fichas.put("/:id", guardar);
fichas.delete("/:id", borrar);
