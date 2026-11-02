import { z } from "zod";

// Los valores de los enums son los nombres de los enums de la app (domain/model/Ficha.kt).
// La app no envía los campos que valen su valor por defecto, por eso todos los textos y las
// listas lo tienen aquí también: lo que falta se guarda como vacío
const Texto = z.string().default("");
const Fecha = z.iso.date().nullish(); // yyyy-MM-dd
const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(); // HH:mm

const PuebloOriginario = z.enum(["WIXARIKA", "NAAYERI", "ODAM_AUDAM", "MEXIKAN"]);

const TipoEspacio = z.enum([
  "SITIO_SAGRADO",
  "LUGAR_SAGRADO",
  "CENTRO_CEREMONIAL",
  "TUKIPA",
  "RUTA_SAGRADA",
  "PATIO_FAMILIAR",
  "CASA_DE_REUNION",
  "CAPILLA",
  "TEYUPANI",
  "OTRO",
]);

const Geometria = z.enum(["PUNTO", "LINEA", "POLIGONO"]);

const TipoRitual = z.enum([
  "PEREGRINACION",
  "FIESTA",
  "CEREMONIA",
  "RITO",
  "OFRENDA",
  "RECOLECCION",
  "CACERIA",
  "CAMPAMENTO",
  "OTRO",
]);

const TipoLugar = z.enum(["NATURAL", "NATURAL_TRANSFORMADO"]);

const PuntoPoligonal = z.object({
  puntoReferencia: Texto,
  utm: Texto,
  margenError: Texto,
  altura: Texto,
});

const Ritual = z.object({
  tipo: TipoRitual.nullish(),
  tipoOtro: Texto,
  nombres: Texto,
  temporalidad: Texto,
  descripcion: Texto,
});

const ElementoEspacio = z.object({
  tipo: TipoLugar.nullish(),
  forma: Texto,
  ancestro: Texto,
  uso: Texto,
  caracteristicas: Texto,
  elementos: Texto,
  largo: Texto,
  ancho: Texto,
  alto: Texto,
  profundidad: Texto,
});

// "Realizadas: __ del archivo __ al __"
const RegistroArchivos = z.object({ cantidad: Texto, desde: Texto, hasta: Texto });

const Participante = z.object({ cargo: Texto, nombre: Texto });

// Campos de la ficha técnica de levantamiento (docs/Ficha.md)
export const DatosFicha = z.object({
  // Registro de levantamiento
  pueblo: PuebloOriginario.nullish(),
  nucleoAgrario: Texto,
  comunidad: Texto,
  numeroLevantamiento: Texto,
  fechaLevantamiento: Fecha,

  // 1. Datos generales
  tipoEspacio: TipoEspacio.nullish(),
  tipoEspacioOtro: Texto,
  nombre: Texto,
  otrosNombres: Texto,
  comoLlegar: Texto,

  // 2. Datos geográficos y de ubicación
  estado: Texto,
  municipio: Texto,
  localidad: Texto,
  tipoPropiedad: Texto,
  lugaresProximos: Texto,
  geometria: Geometria.nullish(),
  puntoGps: Texto,
  altura: Texto,
  area: Texto,
  utm: Texto,
  poligonal: z.array(PuntoPoligonal).default([]),

  // 3. Uso social
  historia: Texto,
  informantes: Texto,
  rituales: z.array(Ritual).default([]),

  // 4. Conformación del espacio sagrado
  descripcionEspacio: Texto,
  elementos: z.array(ElementoEspacio).default([]),

  // 5. Cartografía del informante
  observacionesCartografia: Texto,

  // 6. Estado de conservación
  danos: Texto,
  riesgos: Texto,

  // 7. Información técnica del levantamiento
  fechaTecnica: Fecha,
  horaInicio: Hora,
  horaFin: Hora,
  fotografias: RegistroArchivos.prefault({}),
  grabaciones: RegistroArchivos.prefault({}),
  duracionGrabacion: Texto,
  georreferencias: RegistroArchivos.prefault({}),
  integrantesEquipo: Texto,
  comentariosFinales: Texto,

  // 8. Aval comunitario / ejidal / autoridad local
  autoridadLocal: Texto,
  participantes: z.array(Participante).default([]),
});

export type DatosFicha = z.infer<typeof DatosFicha>;

// JSON de la ficha (entityId va en la URL): el contenido va en `datos`, junto a lo que controla la app
export const Ficha = z.object({
  datos: DatosFicha,
  createdAt: z.int().nonnegative(),
});

export type Ficha = z.infer<typeof Ficha>;

// Cuerpo de POST y PUT: la ficha y la versión en la que se basó la edición (vacía al crear)
export const FichaEnvio = Ficha.extend({
  baseVersion: z.int().nonnegative().nullish(),
});

export type FichaEnvio = z.infer<typeof FichaEnvio>;
