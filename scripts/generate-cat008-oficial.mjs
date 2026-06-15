// Genera la migracion SQL y los mapas de CAT-008 (Distrito) con los codigos
// OFICIALES del Ministerio de Hacienda (alfabeticos, unicos dentro del
// departamento) y su asociacion al municipio (zona) CAT-013 segun la Ley
// Especial para la Reestructuracion Municipal 2023.
//
// La columna `codigo` se mantiene como geo de 4 digitos (departamento + codigo
// CAT-008) para conservar compatibilidad con la logica existente del front /
// resolve-location. `codigo_dte` es el codigo CAT-008 de 2 digitos que se
// envia a Hacienda.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "scripts", "data", "mh-cat008-distritos-oficial.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const sqlEscape = (s) => String(s).replace(/'/g, "''");
const pad2 = (s) => String(s).replace(/\D/g, "").slice(-2).padStart(2, "0");

const rows = [];
const distritosByMunicipio = {};
for (const dept of data.departamentos) {
  const d = pad2(dept.departamento);
  for (const muni of dept.municipios) {
    const m = pad2(muni.municipio);
    const key = `${d}-${m}`;
    for (const dis of muni.distritos) {
      const dte = pad2(dis.codigo);
      const geo = `${d}${dte}`;
      rows.push({
        departamento: d,
        municipio: m,
        geo,
        codigoDte: dte,
        valor: dis.valor,
      });
      if (!distritosByMunicipio[key]) distritosByMunicipio[key] = [];
      distritosByMunicipio[key].push({ codigo: dte, valor: dis.valor });
    }
  }
}

// Ordena distritos por nombre dentro de cada municipio para el dropdown.
for (const key of Object.keys(distritosByMunicipio)) {
  distritosByMunicipio[key].sort((a, b) => a.valor.localeCompare(b.valor, "es"));
}

// Actualiza ubicacion-maps.json preservando municipiosByDepartamento.
const mapsPath = path.join(root, "verificador-dte", "lib", "facturacion", "data", "ubicacion-maps.json");
let maps = {};
if (fs.existsSync(mapsPath)) {
  maps = JSON.parse(fs.readFileSync(mapsPath, "utf8"));
}
maps.distritosByMunicipio = distritosByMunicipio;
// Mapas legacy basados en el modelo anterior (zonas geograficas) ya no son validos.
delete maps.distritoGeoZona;
delete maps.zonaDistritos;
fs.writeFileSync(mapsPath, `${JSON.stringify(maps, null, 2)}\n`, "utf8");

const inserts = rows
  .map(
    (r) =>
      `('${r.departamento}', '${r.municipio}', '${r.geo}', '${r.codigoDte}', '${sqlEscape(r.valor)}')`
  )
  .join(",\n");

const sql = `-- ============================================================
-- CAT-008 Distrito OFICIAL (Ministerio de Hacienda) + asociacion al
-- municipio (zona) CAT-013 segun Ley Especial de Reestructuracion Municipal.
-- Generado por scripts/generate-cat008-oficial.mjs
--
-- codigo      = geo de 4 digitos (departamento + codigo CAT-008)
-- codigo_dte  = codigo CAT-008 de 2 digitos que se envia a Hacienda
-- La clave real para validar es (departamento_codigo, municipio_codigo, codigo_dte).
-- ============================================================

DROP TABLE IF EXISTS cat_008_distrito CASCADE;

CREATE TABLE cat_008_distrito (
    id SERIAL PRIMARY KEY,
    departamento_codigo VARCHAR(2) NOT NULL,
    municipio_codigo VARCHAR(2) NOT NULL,
    codigo VARCHAR(4) NOT NULL,
    codigo_dte VARCHAR(2) NOT NULL,
    valor TEXT NOT NULL,
    UNIQUE (departamento_codigo, codigo_dte)
);

INSERT INTO cat_008_distrito (departamento_codigo, municipio_codigo, codigo, codigo_dte, valor) VALUES
${inserts};

CREATE INDEX IF NOT EXISTS idx_cat_008_dept ON cat_008_distrito(departamento_codigo);
CREATE INDEX IF NOT EXISTS idx_cat_008_dept_muni ON cat_008_distrito(departamento_codigo, municipio_codigo);
CREATE INDEX IF NOT EXISTS idx_cat_008_codigo ON cat_008_distrito(codigo);
`;

const outPath = path.join(root, "scripts", "fix-cat008-oficial.sql");
fs.writeFileSync(outPath, sql, "utf8");

console.log(`OK SQL:  ${outPath}`);
console.log(`OK maps: ${mapsPath}`);
console.log(`Distritos: ${rows.length}`);
