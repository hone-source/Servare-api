import { Hono } from "@hono/hono";

export const health = new Hono();

health.get("/", (c) => c.json({ status: "ok" }));
