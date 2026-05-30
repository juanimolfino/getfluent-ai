import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let queryClient: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function cleanDatabaseUrl(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    queryClient = postgres(cleanDatabaseUrl(databaseUrl), { prepare: false });
    db = drizzle(queryClient, { schema });
  }
  return db;
}
