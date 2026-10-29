import { readFile } from "node:fs/promises";
import { db } from "./connection.js";

const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf-8");

try {
  await db.query(schema);
  console.log("Database migrated successfully");
} catch (error) {
  console.error("Failed to migrate database", error);
  process.exitCode = 1;
} finally {
  await db.end();
}
