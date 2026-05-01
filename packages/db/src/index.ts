import { Pool } from "@neondatabase/serverless";
import { env } from "@test-evals/env/server";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "./schema";

export function createDb() {
  // @neondatabase/serverless Pool uses WebSocket transport, which handles
  // Neon's serverless architecture correctly. Unlike pg.Pool with PgBouncer,
  // this driver is designed to reconnect gracefully without stale-connection
  // errors between queries.
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export const db = createDb();
