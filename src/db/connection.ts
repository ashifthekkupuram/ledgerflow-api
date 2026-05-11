import { Pool } from "pg";
import { remember } from "@epic-web/remember";
import { drizzle } from "drizzle-orm/node-postgres";

import { env, isProd } from "../../env.ts";
import * as schema from "./schema.ts";

const createPool = () => {
  return new Pool({ connectionString: env.DATABASE_CONNECTION_URL });
};

let client: Pool;
if (isProd()) {
  client = createPool();
} else {
  client = remember("dbPool", () => createPool());
}

export const db = drizzle({ client, schema });

export default db;

export { client };
