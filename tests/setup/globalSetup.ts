import db from "../../src/db/connection";
import {
  users,
  accounts,
  tags,
  accountTransactions,
  transactionTags,
} from "../../src/db/schema.ts";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";

export default async function () {
  console.log("Setting up the DB setup...");
  try {
    await db.execute(sql`DROP TABLE IF EXISTS ${transactionTags} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${tags} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${accountTransactions} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${accounts} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS ${users} CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS user_sessions CASCADE`);
    

    console.log("Pushing Schemas to DB...");
    execSync(
      `npx drizzle-kit push --url=${process.env.DATABASE_CONNECTION_URL} --schema="./src/db/schema.ts" --dialect="postgresql"`,
      {
        stdio: "inherit",
        cwd: process.cwd(),
      },
    );

    console.log("Test DB Created...");
  } catch (e) {
    console.log("Failed to setup db");
    throw e;
  }

  return async () => {
    try {
      await db.execute(sql`DROP TABLE IF EXISTS ${transactionTags} CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS ${tags} CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS ${accountTransactions} CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS ${accounts} CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS ${users} CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS user_sessions CASCADE`);
      process.exit(0);
    } catch (e) {
      console.log("Failed to setup db");
      throw e;
    }
  };
}
