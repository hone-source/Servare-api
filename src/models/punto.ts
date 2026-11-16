import { z } from "zod";

// JSON de un punto guardado desde el mapa (entityId va en la URL)
export const Punto = z.object({
  nombre: z.string().trim().min(1),
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
  createdAt: z.int().nonnegative(),
});

export type Punto = z.infer<typeof Punto>;

// Cuerpo de POST y PUT: el punto y la versión en la que se basó la edición (vacía al crear)
export const PuntoEnvio = Punto.extend({
  baseVersion: z.int().nonnegative().nullish(),
});

export type PuntoEnvio = z.infer<typeof PuntoEnvio>;
