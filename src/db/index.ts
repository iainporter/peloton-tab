import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL!;

// Local development: send HTTP queries to the Neon proxy from docker-compose.yml
// rather than Neon's cloud endpoint (see .env.development.local)
const LOCAL_DB_HOST = "db.localtest.me";
if (databaseUrl && new URL(databaseUrl).hostname === LOCAL_DB_HOST) {
  neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
}

const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema });
