import "./env.js";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { db } from "../../src/database/connection.js";

export const API_KEY = process.env.API_KEY;

const databaseUrl = new URL(process.env.DATABASE_URL);
const databaseName = databaseUrl.pathname.slice(1);

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run E2E tests against "${databaseName}": the database name must end with "_test".`,
  );
}

async function createDatabaseIfMissing() {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}

export async function setupDatabase() {
  await createDatabaseIfMissing();

  const schema = await readFile(
    new URL("../../src/database/schema.sql", import.meta.url),
    "utf-8",
  );
  await db.query(schema);
}

export async function resetDatabase() {
  await db.query("TRUNCATE TABLE posts");
}

export async function closeDatabase() {
  await db.end();
}
