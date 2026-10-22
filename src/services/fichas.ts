import { sql } from "../config/db.ts";
import type { Ficha } from "../models/ficha.ts";

type Fila = Record<string, unknown>;

// Cada lista de la ficha vive en su propia tabla, ordenada por "orden" (ver db/init/ficha.sql).
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

// Resumen para la lista de fichas (FichaResumen sin pendienteSincronizar, que es local de la app).
export function listarFichas() {
  return sql`
    select id as entity_id, nombre, tipo_espacio, comunidad, fecha_levantamiento
    from fichas
    order by updated_at desc
  `;
}

export async function obtenerFicha(id: string): Promise<Fila | null> {
  const [fila] = await sql`select * from fichas where id = ${id}`;
  if (!fila) return null;

  const ficha = aFicha(fila);
  for (const [lista, tabla] of Object.entries(LISTAS)) {
    const items = await sql`select * from ${sql(tabla)} where ficha_id = ${id} order by orden`;
    ficha[lista] = items.map(({ fichaId: _fichaId, orden: _orden, ...item }) => item);
  }
  return ficha;
}

// Inserta o sobrescribe la ficha con sus listas. Devuelve true si la ficha es nueva.
export function guardarFicha(id: string, ficha: Ficha): Promise<boolean> {
  const fila = aFila(id, ficha);

  return sql.begin(async (tx) => {
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
}

// Las listas se borran en cascada. Devuelve false si la ficha no existía.
export async function borrarFicha(id: string): Promise<boolean> {
  const borradas = await sql`delete from fichas where id = ${id}`;
  return borradas.count > 0;
}
