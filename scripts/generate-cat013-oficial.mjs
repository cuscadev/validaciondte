// Genera la migracion SQL y los mapas de CAT-013 (Municipio) con los codigos
// OFICIALES del Ministerio de Hacienda, donde el codigo de municipio es unico
// SOLO dentro de su departamento (se repiten entre departamentos).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "scripts", "data", "mh-cat013-municipios-oficial.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const sqlEscape = (s) => String(s).replace(/'/g, "''");

const rows = [];
for (const dept of data.departamentos) {
  for (const m of dept.municipios) {
    rows.push({ departamento: dept.departamento, codigo: m.codigo, valor: m.valor });
  }
}

// Mapa department-scoped para el front y validacion: dept -> [{codigo, valor}]
const municipiosByDepartamento = {};
for (const r of rows) {
  if (!municipiosByDepartamento[r.departamento]) municipiosByDepartamento[r.departamento] = [];
  municipiosByDepartamento[r.departamento].push({ codigo: r.codigo, valor: r.valor });
}

// Actualiza ubicacion-maps.json preservando claves existentes (distritos).
const mapsPath = path.join(root, "verificador-dte", "lib", "facturacion", "data", "ubicacion-maps.json");
let maps = {};
if (fs.existsSync(mapsPath)) {
  maps = JSON.parse(fs.readFileSync(mapsPath, "utf8"));
}
maps.municipiosByDepartamento = municipiosByDepartamento;
// municipioDepartamento global ya no es valido (codigos repetidos); lo eliminamos.
delete maps.municipioDepartamento;
fs.writeFileSync(mapsPath, `${JSON.stringify(maps, null, 2)}\n`, "utf8");

const inserts = rows
  .map((r) => `('${r.departamento}', '${r.codigo}', '${sqlEscape(r.valor)}')`)
  .join(",\n");

const sql = `-- ============================================================
-- CAT-013 Municipio OFICIAL (Ministerio de Hacienda)
-- Generado por scripts/generate-cat013-oficial.mjs
-- IMPORTANTE: el codigo de municipio es unico SOLO dentro del departamento.
-- La clave real es (departamento_codigo, codigo).
-- ============================================================

DROP TABLE IF EXISTS cat_013_municipio CASCADE;

CREATE TABLE cat_013_municipio (
    id SERIAL PRIMARY KEY,
    departamento_codigo VARCHAR(2) NOT NULL,
    codigo VARCHAR(2) NOT NULL,
    valor TEXT NOT NULL,
    UNIQUE (departamento_codigo, codigo)
);

INSERT INTO cat_013_municipio (departamento_codigo, codigo, valor) VALUES
${inserts};

CREATE INDEX IF NOT EXISTS idx_cat_013_dept ON cat_013_municipio(departamento_codigo);
`;

const outPath = path.join(root, "scripts", "fix-cat013-oficial.sql");
fs.writeFileSync(outPath, sql, "utf8");

console.log(`OK SQL:  ${outPath}`);
console.log(`OK maps: ${mapsPath}`);
console.log(`Municipios: ${rows.length}`);
