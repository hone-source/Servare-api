// Secreto con el que se firman y verifican los tokens de sesión (JWT)
export function secretoJwt(): string {
  const secreto = Deno.env.get("JWT_SECRET");
  if (!secreto) throw new Error("Falta la variable de entorno JWT_SECRET");
  return secreto;
}
