import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(root, "database", "migrations");
const direction = process.argv.includes("--down") ? "down" : "up";
const baseline = process.argv.includes("--baseline");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (baseline && direction === "down") throw new Error("--baseline cannot be combined with --down");
if (direction === "down" && process.env.EVENT_DEPLOYMENT_ROLE === "production" && process.env.CONFIRM !== "prod") throw new Error("Refusing down migration in production without CONFIRM=prod");
if (direction === "down" && process.env.EVENT_DEPLOYMENT_ROLE !== "production" && process.env.CONFIRM !== "migration-down") throw new Error("Refusing down migration without CONFIRM=migration-down");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )`);
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(`.${direction}.sql`))
      .sort();
    if (baseline) {
      for (const file of files.filter((candidate) => candidate.endsWith(".up.sql"))) {
        const version = basename(file, ".up.sql");
        await client.query("insert into schema_migrations (version) values ($1) on conflict (version) do nothing", [version]);
      }
      await client.query("commit");
      console.log(`Baselined ${files.filter((file) => file.endsWith(".up.sql")).length} migration(s) without running SQL.`);
      return;
    }
    const applied = await client.query("select version from schema_migrations");
    const appliedVersions = new Set(applied.rows.map((row) => row.version as string));
    const pending = direction === "up"
      ? files.filter((file) => !appliedVersions.has(basename(file, ".up.sql")))
      : files.filter((file) => appliedVersions.has(basename(file, ".down.sql"))).reverse();

    for (const file of pending) {
      const version = direction === "up" ? basename(file, ".up.sql") : basename(file, ".down.sql");
      console.log(`${direction === "up" ? "Applying" : "Reverting"} ${version}`);
      await client.query(await readFile(join(migrationsDir, file), "utf8"));
      if (direction === "up") await client.query("insert into schema_migrations (version) values ($1)", [version]);
      else await client.query("delete from schema_migrations where version = $1", [version]);
    }
    await client.query("commit");
    console.log(pending.length ? `${direction === "up" ? "Applied" : "Reverted"} ${pending.length} migration(s).` : "No migrations to run.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => pool.end());
