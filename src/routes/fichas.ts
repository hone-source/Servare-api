import { Hono } from "@hono/hono";
import { actualizar, borrar, crear, listar } from "../controllers/fichas.ts";

export const fichas = new Hono();

fichas.post("/:id", crear);        //C
fichas.get("/", listar);           //R
fichas.put("/:id", actualizar);    //U
fichas.delete("/:id", borrar);     //D
