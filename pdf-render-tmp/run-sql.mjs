import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("c:/Users/Admin/Desktop/proyectosengo/verificador-dte/package.json");
const { Client } = require("pg");

const url = "postgresql://postgres.lovzumhcaqsopdcnmwco:Desarrollo2026@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const args = process.argv.slice(2);
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("connected");

const inlineSql = args.filter((a) => !a.endsWith(".sql"));
const files = args.filter((a) => a.endsWith(".sql"));

async function runSql(label, sql) {
  console.log(`\n=== ${label} ===`);
  try {
    const res = await client.query(sql);
    const results = Array.isArray(res) ? res : [res];
    for (const r of results) {
      if (r && r.rows && r.rows.length) console.table(r.rows.slice(0, 30));
      else if (r && r.command) console.log(`${r.command} ${r.rowCount ?? ""}`.trim());
    }
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  }
}

for (const f of files) await runSql(path.basename(f), fs.readFileSync(f, "utf8"));
for (const s of inlineSql) await runSql("inline", s);

await client.end();
console.log("\ndone");
