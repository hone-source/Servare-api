// Índices de las colecciones.
// Corre solo al crear el volumen `db-data` por primera vez (los índices son idempotentes).

db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || "servare");

// Orden de la lista de pruebas (más reciente primero)
db.pruebas.createIndex({ createdAt: -1 });

// Un correo, una cuenta. También resuelve el registro simultáneo del mismo correo
db.usuarios.createIndex({ correo: 1 }, { unique: true });

// Orden de la lista de fichas (más reciente primero)
db.fichas.createIndex({ updatedAt: -1 });

// Resultados de operaciones ya aplicadas (Idempotency-Key). 
// Se conservan 30 días: un reintento de la app tras una larga desconexión
// sigue recibiendo la respuesta de la primera vez
db.operaciones.createIndex({ creadoEn: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
