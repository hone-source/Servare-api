-- Script par crear la tabla de Ficha

BEGIN;

CREATE TYPE pueblo_originario AS ENUM ('WIXARIKA', 'NAAYERI', 'ODAM_AUDAM', 'MEXIKAN');

CREATE TYPE tipo_espacio AS ENUM (
  'SITIO_SAGRADO', 'LUGAR_SAGRADO', 'CENTRO_CEREMONIAL', 'TUKIPA', 'RUTA_SAGRADA',
  'PATIO_FAMILIAR', 'CASA_DE_REUNION', 'CAPILLA', 'TEYUPANI', 'OTRO'
);

CREATE TYPE geometria AS ENUM ('PUNTO', 'LINEA', 'POLIGONO');

CREATE TYPE tipo_ritual AS ENUM (
  'PEREGRINACION', 'FIESTA', 'CEREMONIA', 'RITO', 'OFRENDA', 'RECOLECCION', 'CACERIA',
  'CAMPAMENTO', 'OTRO'
);

CREATE TYPE tipo_lugar AS ENUM ('NATURAL', 'NATURAL_TRANSFORMADO');

CREATE TABLE fichas (
  -- entityId generado por la app: reenviar una ficha la actualiza en vez de duplicarla (RF-08)
  id                         uuid PRIMARY KEY,

  -- Registro de levantamiento
  pueblo                     pueblo_originario,
  nucleo_agrario             text NOT NULL DEFAULT '',
  comunidad                  text NOT NULL DEFAULT '',
  numero_levantamiento       text NOT NULL DEFAULT '',
  fecha_levantamiento        date,

  -- 1. Datos generales
  tipo_espacio               tipo_espacio,
  tipo_espacio_otro          text NOT NULL DEFAULT '',
  nombre                     text NOT NULL DEFAULT '',
  otros_nombres              text NOT NULL DEFAULT '',
  como_llegar                text NOT NULL DEFAULT '',

  -- 2. Datos geográficos y de ubicación (poligonal en ficha_poligonal)
  estado                     text NOT NULL DEFAULT '',
  municipio                  text NOT NULL DEFAULT '',
  localidad                  text NOT NULL DEFAULT '',
  tipo_propiedad             text NOT NULL DEFAULT '',
  lugares_proximos           text NOT NULL DEFAULT '',
  geometria                  geometria,
  punto_gps                  text NOT NULL DEFAULT '',
  altura                     text NOT NULL DEFAULT '',
  area                       text NOT NULL DEFAULT '',
  utm                        text NOT NULL DEFAULT '',

  -- 3. Uso social (rituales en ficha_rituales)
  historia                   text NOT NULL DEFAULT '',
  informantes                text NOT NULL DEFAULT '',

  -- 4. Conformación del espacio sagrado (elementos en ficha_elementos)
  descripcion_espacio        text NOT NULL DEFAULT '',

  -- 5. Cartografía del informante
  observaciones_cartografia  text NOT NULL DEFAULT '',

  -- 6. Estado de conservación
  danos                      text NOT NULL DEFAULT '',
  riesgos                    text NOT NULL DEFAULT '',

  -- 7. Información técnica del levantamiento
  -- RegistroArchivos ("Realizadas: __ del archivo __ al __") aplanado en tres columnas
  fecha_tecnica              date,
  hora_inicio                time,
  hora_fin                   time,
  fotografias_cantidad       text NOT NULL DEFAULT '',
  fotografias_desde          text NOT NULL DEFAULT '',
  fotografias_hasta          text NOT NULL DEFAULT '',
  grabaciones_cantidad       text NOT NULL DEFAULT '',
  grabaciones_desde          text NOT NULL DEFAULT '',
  grabaciones_hasta          text NOT NULL DEFAULT '',
  duracion_grabacion         text NOT NULL DEFAULT '',
  georreferencias_cantidad   text NOT NULL DEFAULT '',
  georreferencias_desde      text NOT NULL DEFAULT '',
  georreferencias_hasta      text NOT NULL DEFAULT '',
  integrantes_equipo         text NOT NULL DEFAULT '',
  comentarios_finales        text NOT NULL DEFAULT '',

  -- 8. Aval comunitario / ejidal / autoridad local (participantes en ficha_participantes)
  autoridad_local            text NOT NULL DEFAULT '',

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- Listas de la ficha: "orden" es la posición en la lista de Kotlin (desde 0).
-- Al sincronizar, la API reemplaza todas las filas de la ficha.

CREATE TABLE ficha_poligonal (
  ficha_id          uuid NOT NULL REFERENCES fichas (id) ON DELETE CASCADE,
  orden             smallint NOT NULL CHECK (orden >= 0),
  punto_referencia  text NOT NULL DEFAULT '',
  utm               text NOT NULL DEFAULT '',
  margen_error      text NOT NULL DEFAULT '',
  altura            text NOT NULL DEFAULT '',
  PRIMARY KEY (ficha_id, orden)
);

CREATE TABLE ficha_rituales (
  ficha_id      uuid NOT NULL REFERENCES fichas (id) ON DELETE CASCADE,
  orden         smallint NOT NULL CHECK (orden >= 0),
  tipo          tipo_ritual,
  tipo_otro     text NOT NULL DEFAULT '',
  nombres       text NOT NULL DEFAULT '',
  temporalidad  text NOT NULL DEFAULT '',
  descripcion   text NOT NULL DEFAULT '',
  PRIMARY KEY (ficha_id, orden)
);

CREATE TABLE ficha_elementos (
  ficha_id         uuid NOT NULL REFERENCES fichas (id) ON DELETE CASCADE,
  orden            smallint NOT NULL CHECK (orden >= 0),
  tipo             tipo_lugar,
  forma            text NOT NULL DEFAULT '',
  ancestro         text NOT NULL DEFAULT '',
  uso              text NOT NULL DEFAULT '',
  caracteristicas  text NOT NULL DEFAULT '',
  elementos        text NOT NULL DEFAULT '',
  largo            text NOT NULL DEFAULT '',
  ancho            text NOT NULL DEFAULT '',
  alto             text NOT NULL DEFAULT '',
  profundidad      text NOT NULL DEFAULT '',
  PRIMARY KEY (ficha_id, orden)
);

CREATE TABLE ficha_participantes (
  ficha_id  uuid NOT NULL REFERENCES fichas (id) ON DELETE CASCADE,
  orden     smallint NOT NULL CHECK (orden >= 0),
  cargo     text NOT NULL DEFAULT '',
  nombre    text NOT NULL DEFAULT '',
  PRIMARY KEY (ficha_id, orden)
);

COMMIT;
