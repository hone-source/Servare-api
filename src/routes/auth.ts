import { Hono } from "@hono/hono";
import { iniciarSesion, registrar } from "../controllers/auth.ts";

export const auth = new Hono();

auth.post("/registro", registrar);
auth.post("/login", iniciarSesion);
