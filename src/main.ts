import { app } from "./app.ts";

const port = Number(Deno.env.get("PORT") ?? 8000);

Deno.serve({ hostname: "0.0.0.0", port }, app.fetch);
