import { MongoClient } from "mongodb";

const url = Deno.env.get("MONGODB_URI") ??
  "mongodb://servare:servare@localhost:27017/servare?authSource=admin";

// El driver conecta de forma perezosa en la primera operación. La base de datos es la de la URI.
export const client = new MongoClient(url);
export const db = client.db();
