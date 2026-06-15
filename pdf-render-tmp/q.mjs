import { createRequire } from "node:module";
const require = createRequire("c:/Users/Admin/Desktop/proyectosengo/verificador-dte/package.json");
const { Client } = require("pg");
const url = process.env.SUPABASE_DB_URL;
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

for (const sql of [
  "SELECT count(*) AS n FROM cat_013_municipio",
  "SELECT count(*) AS n, count(departamento_codigo) AS con_dep FROM cat_013_municipio",
  "SELECT count(*) AS n FROM cat_008_distrito",
  "SELECT * FROM cat_013_municipio WHERE departamento_codigo='05' ORDER BY codigo LIMIT 6",
  "SELECT departamento_codigo, municipio_codigo, codigo, codigo_dte, valor FROM cat_008_distrito WHERE departamento_codigo='05' AND municipio_codigo='28'",
]) {
  try { const r = await c.query(sql); console.log("\n>", sql); console.table(r.rows); }
  catch (e) { console.log("\n>", sql, "\nERR:", e.message); }
}
await c.end();
