import { Hono } from "@hono/hono";
import { actualizar, borrar, crear, listar } from "../controllers/pruebas.ts";

export const pruebas = new Hono();

pruebas.post("/:id", crear);        //C
pruebas.get("/", listar);           //R
pruebas.put("/:id", actualizar);    //U
pruebas.delete("/:id", borrar);     //D
