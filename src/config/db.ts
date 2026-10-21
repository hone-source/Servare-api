import postgres from "postgres";

const url = Deno.env.get("DATABASE_URL") ?? "postgres://servare:servare@localhost:5432/servare";

export const sql = postgres(url, {
  transform: postgres.camel,
  types: {
    date: { to: 1082, 
      from: [1082],
      serialize: (x: string) => x,
      parse: (x: string) => x 
    },
  },
});
