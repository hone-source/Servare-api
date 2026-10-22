import { z } from "zod";

// JSON de la ficha
const texto = z.string().default("");
const fecha = z.iso.date().nullable().default(null);
const hora = z.iso.time().nullable().default(null);
const opcion = <const T extends readonly [string, ...string[]]>(valores: T) =>
  z.enum(valores).nullable().default(null);
const lista = <T extends z.ZodType>(item: T) => z.array(item).default([]);

// "Realizadas: __ del archivo __ al __"
const registroArchivos = z.object({ cantidad: texto, desde: texto, hasta: texto }).prefault({});

export const Ficha = z.object({
  // Registro de levantamiento
  pueblo: opcion(["WIXARIKA", "NAAYERI", "ODAM_AUDAM", "MEXIKAN"]),
  nucleoAgrario: texto,
  comunidad: texto,
  numeroLevantamiento: texto,
  fechaLevantamiento: fecha,

  // 1. Datos generales
  tipoEspacio: opcion([
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
  ]),
  tipoEspacioOtro: texto,
  nombre: texto,
  otrosNombres: texto,
  comoLlegar: texto,

  // 2. Datos geográficos y de ubicación
  estado: texto,
  municipio: texto,
  localidad: texto,
  tipoPropiedad: texto,
  lugaresProximos: texto,
  geometria: opcion(["PUNTO", "LINEA", "POLIGONO"]),
  puntoGps: texto,
  altura: texto,
  area: texto,
  utm: texto,
  poligonal: lista(z.object({
    puntoReferencia: texto,
    utm: texto,
    margenError: texto,
    altura: texto,
  })),

  // 3. Uso social
  historia: texto,
  informantes: texto,
  rituales: lista(z.object({
    tipo: opcion([
      "PEREGRINACION",
      "FIESTA",
      "CEREMONIA",
      "RITO",
      "OFRENDA",
      "RECOLECCION",
      "CACERIA",
      "CAMPAMENTO",
      "OTRO",
    ]),
    tipoOtro: texto,
    nombres: texto,
    temporalidad: texto,
    descripcion: texto,
  })),

  // 4. Conformación del espacio sagrado
  descripcionEspacio: texto,
  elementos: lista(z.object({
    tipo: opcion(["NATURAL", "NATURAL_TRANSFORMADO"]),
    forma: texto,
    ancestro: texto,
    uso: texto,
    caracteristicas: texto,
    elementos: texto,
    largo: texto,
    ancho: texto,
    alto: texto,
    profundidad: texto,
  })),

  // 5. Cartografía del informante
  observacionesCartografia: texto,

  // 6. Estado de conservación
  danos: texto,
  riesgos: texto,

  // 7. Información técnica del levantamiento
  fechaTecnica: fecha,
  horaInicio: hora,
  horaFin: hora,
  fotografias: registroArchivos,
  grabaciones: registroArchivos,
  duracionGrabacion: texto,
  georreferencias: registroArchivos,
  integrantesEquipo: texto,
  comentariosFinales: texto,

  // 8. Aval comunitario / ejidal / autoridad local
  autoridadLocal: texto,
  participantes: lista(z.object({ cargo: texto, nombre: texto })),
});

export type Ficha = z.infer<typeof Ficha>;
