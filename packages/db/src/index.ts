import { Pool } from "pg";
import { env } from "@test-evals/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    // idleTimeoutMillis: 0 releases connections immediately when idle.
    // Neon's PgBouncer pooler (transaction mode) terminates idle connections
    // very quickly; holding them in the app-side pool causes stale-connection
    // errors on the next query. Releasing immediately lets PgBouncer manage
    // the lifecycle.
    idleTimeoutMillis: 0,
    max: 10,
  });

  pool.on("error", () => {
    // Suppress unhandled idle-connection errors that pg-pool emits when the
    // server closes a connection while it sits idle in the pool.
  });

  return drizzle(pool, { schema });
}

export const db = createDb();
