import { app } from "./app.ts";

const port = Number(Deno.env.get("PORT") ?? 8000);

// HTTPS si se definen TLS_CERT y TLS_KEY (certificados de mkcert en desarrollo), si no, HTTP.
const certPath = Deno.env.get("TLS_CERT");
const keyPath = Deno.env.get("TLS_KEY");

if (certPath && keyPath) {
  let cert: string, key: string;
  try {
    cert = Deno.readTextFileSync(certPath);
    key = Deno.readTextFileSync(keyPath);
  } catch (err) {
    throw new Error(`No se pudieron leer TLS_CERT/TLS_KEY (${certPath}, ${keyPath}): ${err}`);
  }
  Deno.serve({ hostname: "0.0.0.0", port, cert, key }, app.fetch);
} else {
  Deno.serve({ hostname: "0.0.0.0", port }, app.fetch);
}
