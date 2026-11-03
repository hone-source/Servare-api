import { z } from "zod";

// Identifica la operación de la app (Idempotency-Key): se repite igual en todos los reintentos
export const ClaveOperacion = z.string().min(1).max(100);
