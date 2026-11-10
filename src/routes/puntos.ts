import { Hono } from "@hono/hono";
import { actualizar, borrar, crear, listar } from "../controllers/puntos.ts";

export const puntos = new Hono();

puntos.post("/:id", crear);        //C
puntos.get("/", listar);           //R
puntos.put("/:id", actualizar);    //U
puntos.delete("/:id", borrar);     //D
