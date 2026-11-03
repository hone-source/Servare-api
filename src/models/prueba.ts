import { z } from "zod";

// JSON del registro de la pantalla de prueba (entityId va en la URL)
export const Prueba = z.object({
  titulo: z.string(),
  texto: z.string(),
  numero: z.int32(),
  createdAt: z.int().nonnegative(),
});

export type Prueba = z.infer<typeof Prueba>;

// Cuerpo de POST y PUT: el registro y la versión en la que se basó la edición (vacía al crear)
export const PruebaEnvio = Prueba.extend({
  baseVersion: z.int().nonnegative().nullish(),
});

export type PruebaEnvio = z.infer<typeof PruebaEnvio>;
