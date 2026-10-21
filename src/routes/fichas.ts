import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { z } from "zod";
import { sql } from "../config/db.ts";

// JSON de la ficha
const texto = z.string().default("");
const fecha = z.iso.date().nullable().default(null);
const hora = z.iso.time().nullable().default(null);
const opcion = <const T extends readonly [string, ...string[]]>(valores: T) =>
  z.enum(valores).nullable().default(null);
const lista = <T extends z.ZodType>(item: T) => z.array(item).default([]);

// "Realizadas: __ del archivo __ al __"
const registroArchivos = z.object({ cantidad: texto, desde: texto, hasta: texto }).prefault({});

const Ficha = z.object({
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

type Ficha = z.infer<typeof Ficha>;
type Fila = Record<string, unknown>;

// Cada lista de la ficha vive en su propia tabla, ordenada por "orden" (ver db/init/001_fichas.sql).
const LISTAS = {
  poligonal: "ficha_poligonal",
  rituales: "ficha_rituales",
  elementos: "ficha_elementos",
  participantes: "ficha_participantes",
} as const;

// Cada RegistroArchivos se guarda aplanado: fotografias.cantidad -> fotografias_cantidad.
const REGISTROS = ["fotografias", "grabaciones", "georreferencias"] as const;
const PARTES = ["cantidad", "desde", "hasta"] as const;
const columna = (registro: string, parte: string) =>
  registro + parte[0].toUpperCase() + parte.slice(1);

function leerId(id: string): string {
  if (!z.guid().safeParse(id).success) {
    throw new HTTPException(400, { message: "El id de la ficha debe ser un UUID" });
  }
  return id;
}

async function leerFicha(req: Request): Promise<Ficha> {
  const body = await req.json().catch(() => null);
  const result = Ficha.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

// Ficha -> fila de `fichas`, sin las listas y con los registros aplanados.
function aFila(id: string, ficha: Ficha): Fila {
  const fila: Fila = { ...ficha, id };
  for (const lista of Object.keys(LISTAS)) delete fila[lista];
  for (const registro of REGISTROS) {
    delete fila[registro];
    for (const parte of PARTES) fila[columna(registro, parte)] = ficha[registro][parte];
  }
  return fila;
}

// Fila de `fichas` -> Ficha, sin las listas (se agregan aparte).
function aFicha({ id: _id, createdAt: _creada, updatedAt: _actualizada, ...fila }: Fila): Fila {
  for (const registro of REGISTROS) {
    const valores: Fila = {};
    for (const parte of PARTES) {
      valores[parte] = fila[columna(registro, parte)];
      delete fila[columna(registro, parte)];
    }
    fila[registro] = valores;
  }
  return fila;
}

export const fichas = new Hono();

// Resumen para la lista de fichas (FichaResumen sin pendienteSincronizar, que es local de la app).
fichas.get("/", async (c) => {
  const resumenes = await sql`
    select id as entity_id, nombre, tipo_espacio, comunidad, fecha_levantamiento
    from fichas
    order by updated_at desc
  `;
  return c.json(resumenes);
});

fichas.get("/:id", async (c) => {
  const id = leerId(c.req.param("id"));
  const [fila] = await sql`select * from fichas where id = ${id}`;
  if (!fila) throw new HTTPException(404, { message: "Ficha no encontrada" });

  const ficha = aFicha(fila);
  for (const [lista, tabla] of Object.entries(LISTAS)) {
    const items = await sql`select * from ${sql(tabla)} where ficha_id = ${id} order by orden`;
    ficha[lista] = items.map(({ fichaId: _fichaId, orden: _orden, ...item }) => item);
  }
  return c.json(ficha);
});

// La app genera el id (entityId), así que crear y actualizar son el mismo PUT: reenviar una
// ficha al sincronizar la sobrescribe en vez de duplicarla. 201 si es nueva, 200 si ya existía.
fichas.put("/:id", async (c) => {
  const id = leerId(c.req.param("id"));
  const ficha = await leerFicha(c.req.raw);
  const fila = aFila(id, ficha);

  const creada = await sql.begin(async (tx) => {
    const [{ creada }] = await tx`
      insert into fichas ${tx(fila)}
      on conflict (id) do update set ${tx(fila)}, updated_at = now()
      returning (xmax = 0) as creada
    `;
    for (const [lista, tabla] of Object.entries(LISTAS)) {
      await tx`delete from ${tx(tabla)} where ficha_id = ${id}`;
      const items = ficha[lista as keyof typeof LISTAS].map((item, orden) => ({
        fichaId: id,
        orden,
        ...item,
      }));
      if (items.length > 0) await tx`insert into ${tx(tabla)} ${tx(items)}`;
    }
    return creada as boolean;
  });

  return c.json(ficha, creada ? 201 : 200);
});

// Las listas se borran en cascada.
fichas.delete("/:id", async (c) => {
  const id = leerId(c.req.param("id"));
  const borradas = await sql`delete from fichas where id = ${id}`;
  if (borradas.count === 0) throw new HTTPException(404, { message: "Ficha no encontrada" });
  return c.body(null, 204);
});
