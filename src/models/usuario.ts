import { z } from "zod";

// El correo se normaliza (sin espacios, en minúsculas) antes de validarlo
const Correo = z.string().trim().toLowerCase().pipe(z.email());

// JSON del registro de usuario
export const Registro = z.object({
  correo: Correo,
  contrasena: z.string().min(8).max(128),
});

export type Registro = z.infer<typeof Registro>;

// JSON del inicio de sesión. La contraseña no se valida más allá de existir: la longitud mínima
// es regla del registro, y aquí cualquier valor incorrecto se responde igual (401)
export const Credenciales = z.object({
  correo: Correo,
  contrasena: z.string().min(1).max(128),
});

export type Credenciales = z.infer<typeof Credenciales>;

// Identifica el intento de registro: se repite igual en todos los reintentos de la app
export const ClaveRegistro = z.string().min(1).max(100);
