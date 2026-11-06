/**
 * Run Mangalam SQL migrations against a Supabase Postgres database.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgres://..." node scripts/run-supabase-migrations.mjs
 *
 * Or rely on backend/.env with either:
 *   SUPABASE_DB_URL=...
 *   or a line "db password:" followed by the password on the next line
 *   (ref host: behlrsqilhzhniglhgqh from docs)
 *
 * @type {import("pg").ClientConfig}
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(join(root, "backend", "package.json"));
const pg = require("pg");

function loadEnvFromBackendDotEnv() {
  try {
    const raw = readFileSync(join(root, "backend", ".env"), "utf8");
    const lines = raw.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    const idx = lines.findIndex((l) => /^db\s*password\s*:?\s*$/i.test(l.trim()));
    if (idx !== -1 && lines[idx + 1]) {
      env._RAW_DB_PASSWORD = lines[idx + 1].trim();
    }
    return env;
  } catch {
    return {};
  }
}

/**
 * Supabase: use session pooler port 5432 for DDL (not transaction pooler 6543).
 * Avoid sslmode=require in the URL — recent `pg` treats it as verify-full and fails on pooler certs.
 */
function resolveClientConfig() {
  const ssl = { rejectUnauthorized: false };
  if (process.env.SUPABASE_DB_URL) {
    return { connectionString: process.env.SUPABASE_DB_URL, ssl };
  }
  const fileEnv = loadEnvFromBackendDotEnv();
  if (fileEnv.SUPABASE_DB_URL) {
    return { connectionString: fileEnv.SUPABASE_DB_URL, ssl };
  }
  const password = process.env.SUPABASE_DB_PASSWORD || fileEnv._RAW_DB_PASSWORD;
  if (!password) {
    throw new Error(
      "Set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD, or add db password to backend/.env (see script header)."
    );
  }
  const projectRef =
    process.env.SUPABASE_PROJECT_REF || "behlrsqilhzhniglhgqh";
  const usePooler = process.env.SUPABASE_USE_POOLER === "true";
  const host =
    process.env.SUPABASE_DB_HOST ||
    (usePooler
      ? process.env.SUPABASE_POOLER_HOST || "aws-0-us-east-1.pooler.supabase.com"
      : `db.${projectRef}.supabase.co`);
  const user =
    process.env.SUPABASE_DB_USER ||
    (usePooler ? `postgres.${projectRef}` : "postgres");
  const port = parseInt(process.env.SUPABASE_DB_PORT || "5432", 10);
  return {
    host,
    port,
    user,
    password,
    database: "postgres",
    ssl,
  };
}

async function run() {
  const client = new pg.Client(resolveClientConfig());
  await client.connect();
  try {
    const migration1 = readFileSync(
      join(root, "supabase", "migrations", "0001_initial_schema.sql"),
      "utf8"
    );
    const migration2 = readFileSync(
      join(root, "supabase", "migrations", "0002_profile_sections.sql"),
      "utf8"
    );
    console.info("Applying 0001_initial_schema.sql …");
    await client.query(migration1);
    console.info("Applying 0002_profile_sections.sql …");
    await client.query(migration2);
    const { rows } = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'profiles'"
    );
    console.info("Done. public.profiles present:", rows[0]?.n === 1);
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
