// Contraseñas con PBKDF2-SHA256 (Web Crypto, sin dependencias).
// Formato guardado: pbkdf2$iteraciones$sal$hash (sal y hash en base64)

const ITERACIONES = 600_000;
const BYTES_SAL = 16;
const BYTES_HASH = 32;

function aBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

async function derivar(
  contrasena: string,
  sal: Uint8Array,
  iteraciones: number,
): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(contrasena),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: sal as BufferSource, iterations: iteraciones },
    clave,
    BYTES_HASH * 8,
  );
  return new Uint8Array(bits);
}

// Compara sin cortar en el primer byte distinto
function iguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
  return diferencia === 0;
}

export async function hashearContrasena(contrasena: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL));
  const hash = await derivar(contrasena, sal, ITERACIONES);
  return `pbkdf2$${ITERACIONES}$${aBase64(sal)}$${aBase64(hash)}`;
}

export async function verificarContrasena(contrasena: string, guardado: string): Promise<boolean> {
  const [esquema, iteraciones, sal, hash] = guardado.split("$");
  if (esquema !== "pbkdf2" || !iteraciones || !sal || !hash) return false;
  const calculado = await derivar(contrasena, deBase64(sal), Number(iteraciones));
  return iguales(calculado, deBase64(hash));
}
