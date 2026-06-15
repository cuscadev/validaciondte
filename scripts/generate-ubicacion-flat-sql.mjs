/**
 * Genera scripts/fix-ubicacion-flat.sql desde la jerarquia LERM2023
 * con codigos oficiales MH (CAT-012, CAT-013, CAT-008).
 * Uso: node scripts/generate-ubicacion-flat-sql.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

const mhCatalog = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'mh-cat012-cat013.json'), 'utf8')
);
const mhDistritos262 = JSON.parse(
  fs.readFileSync(path.join(dataDir, 'mh-cat008-distritos-262.json'), 'utf8')
);

const DEPT_CODES = {
  'DEPARTAMENTO DE AHUACHAPÁN': '01',
  'DEPARTAMENTO DE SANTA ANA': '02',
  'DEPARTAMENTO DE SONSONATE': '03',
  'DEPARTAMENTO DE CHALATENANGO': '04',
  'DEPARTAMENTO DE LA LIBERTAD': '05',
  'DEPARTAMENTO DE SAN SALVADOR': '06',
  'DEPARTAMENTO DE CUSCATLÁN': '07',
  'DEPARTAMENTO DE CABAÑAS': '09',
  'DEPARTAMENTO DE SAN VICENTE': '10',
  'DEPARTAMENTO DE LA PAZ': '08',
  'DEPARTAMENTO DE USULUTÁN': '11',
  'DEPARTAMENTO DE SAN MIGUEL': '12',
  'DEPARTAMENTO DE MORAZÁN': '13',
  'DEPARTAMENTO DE LA UNIÓN': '14',
};

const DEPT_VALORES = Object.fromEntries(
  mhCatalog.catalogo.cat012.departamentos
    .filter((d) => d.codigo !== '00')
    .map((d) => [d.codigo, d.nombre])
);

/** Zonas de la jerarquia LERM que se mapean a un municipio CAT-013 oficial */
const MUNICIPIO_ZONE_ALIASES = {
  '02|SANTA ANA ESTE': '18',
  '03|SONSONATE ESTE': '22',
  '05|LA LIBERTAD ESTE': '29',
  '05|LA LIBERTAD COSTA': '30',
  '06|SAN SALVADOR ESTE': '33',
  '08|LA PAZ OESTE': '38',
  '09|CABANAS OESTE': '11',
};

const officialMunicipioCodes = new Map(
  mhCatalog.catalogo.cat013.municipios
    .filter((m) => m.codigoDepartamento !== '00')
    .map((m) => [`${m.codigoDepartamento}|${normalizeKey(m.nombre)}`, pad2(m.codigo)])
);

const distritoCodigoByDeptName = new Map();
for (const dept of mhDistritos262.departamentos) {
  for (const distrito of dept.municipios) {
    distritoCodigoByDeptName.set(
      `${dept.codigo}|${normalizeKey(distrito.nombre)}`,
      pad2(distrito.codigoMunicipio)
    );
  }
}

const RAW = `
DEPARTAMENTO DE AHUACHAPÁN
Municipio de Ahuachapán Norte
Distrito de Atiquizaya
Distrito de El Refugio
Distrito de San Lorenzo
Distrito de Turín
Municipio de Ahuachapán Centro
Distrito de Ahuachapán
Distrito de Apaneca
Distrito de Concepción de Ataco
Distrito de Tacuba
Municipio de Ahuachapán Sur
Distrito de Guaymango
Distrito de Jujutla
Distrito de San Francisco Menendez
Distrito de San Pedro Puxtla
DEPARTAMENTO DE SAN SALVADOR
Municipio de San Salvador Norte
Distrito de Aguilares
Distrito de El Paisnal
Distrito de Guazapa
Municipio de San Salvador Oeste
Distrito de Apopa
Distrito de Nejapa
Municipio de San Salvador Este
Distrito de Ilopango
Distrito de San Martín
Distrito de Soyapango
Distrito de Tonacatepeque
Municipio de San Salvador Centro
Distrito de Ayutuxtepeque
Distrito de Mejicanos
Distrito de San Salvador
Distrito de Cuscatancingo
Distrito de Ciudad Delgado
Municipio de San Salvador Sur
Distrito de Panchimalco
Distrito de Rosario de Mora
Distrito de San Marcos
Distrito de Santo Tomás
Distrito de Santiago Texacuangos
DEPARTAMENTO DE LA LIBERTAD
Municipio de La Libertad Norte
Distrito de Quezaltepeque
Distrito de San Matías
Distrito de San Pablo Tacachico
Municipio de La Libertad Centro
Distrito de San Juan Opico
Distrito de Ciudad Arce
Municipio de La Libertad Oeste
Distrito de Colón
Distrito de Jayaque
Distrito de Sacacoyo
Distrito de Tepecoyo
Distrito de Talnique
Municipio de La Libertad Este
Distrito de Antiguo Cuscatlán
Distrito de Huizucar
Distrito de Nuevo Cuscatlán
Distrito de San José Villanueva
Distrito de Zaragoza
Municipio de La Libertad Costa
Distrito de Chiltuipán
Distrito de Jicalapa
Distrito de La Libertad
Distrito de Tamanique
Distrito de Teotepeque
Municipio de La Libertad Sur
Distrito de Comasagua
Distrito de Santa Tecla
DEPARTAMENTO DE CHALATENANGO
Municipio de Chalatenango Norte
Distrito de La Palma
Distrito de Citalá
Distrito de San Ignacio
Municipio de Chalatenango Centro
Distrito de Nueva Concepción
Distrito de Tejutla
Distrito de La Reina
Distrito de Agua Caliente
Distrito de Dulce Nombre de María
Distrito de El Paraíso
Distrito de San Francisco Morazán
Distrito de San Rafael
Distrito de Santa Rita
Distrito de San Fernando
Municipio de Chalatenango Sur
Distrito de Chalatenango
Distrito de Arcatao
Distrito de Azacualpa
Distrito de Comalapa
Distrito de Concepción Quezaltepeque
Distrito de El Carrizal
Distrito de La Laguna
Distrito de Las Vueltas
Distrito de Nombre de Jesús
Distrito de Nueva Trinidad
Distrito de Ojos de Agua
Distrito de Potonico
Distrito de San Antonio de La Cruz
Distrito de San Antonio Los Ranchos
Distrito de San Francisco Lempa
Distrito de San Isidro Labrador
Distrito de San José Cancasque
Distrito de San Miguel de Mercedes
Distrito de San José Las Flores
Distrito de San Luis del Carmen
DEPARTAMENTO DE CUSCATLÁN
Municipio de Cuscatlán Norte
Distrito de Suchitoto
Distrito de San José Guayabal
Distrito de Oratorio de Concepción
Distrito de San Bartolomé Perulapán
Distrito de San Pedro Perulapán
Municipio de Cuscatlán Sur
Distrito de Cojutepeque
Distrito de San Rafael Cedros
Distrito de Candelaria
Distrito de Monte San Juan
Distrito de El Carmen
Distrito de San Cristóbal
Distrito de Santa Cruz Michapa
Distrito de San Ramón
Distrito de El Rosario
Distrito de Santa Cruz Analquito
Distrito de Tenancingo
DEPARTAMENTO DE CABAÑAS
Municipio de Cabañas Este
Distrito de Sensuntepeque
Distrito de Victoria
Distrito de Dolores
Distrito de Guacotecti
Distrito de San Isidro
Municipio de Cabañas Oeste
Distrito de Ilobasco
Distrito de Tejutepeque
Distrito de Jutiapa
Distrito de Cinquera
DEPARTAMENTO DE LA PAZ
Municipio de La Paz Oeste
Distrito de Cuyultitán
Distrito de Olocuilta
Distrito de San Juan Talpa
Distrito de San Luis Talpa
Distrito de San Pedro Masahuat
Distrito de Tapalhuaca
Distrito de San Francisco Chinameca
Municipio de La Paz Centro
Distrito de El Rosario
Distrito de Jerusalén
Distrito de Mercedes La Ceiba
Distrito de Paraíso de Osorio
Distrito de San Antonio Masahuat
Distrito de San Emigdio
Distrito de San Juan Tepezontes
Distrito de San Luis La Herradura
Distrito de San Miguel Tepezontes
Distrito de San Pedro Nonualco
Distrito de Santa María Ostuma
Distrito de Santiago Nonualco
Municipio de La Paz Este
Distrito de San Juan Nonualco
Distrito de San Rafael Obrajuelo
Distrito de Zacatecoluca
DEPARTAMENTO DE LA UNIÓN
Municipio de La Unión Norte
Distrito de Anamorós
Distrito de Bolivar
Distrito de Concepción de Oriente
Distrito de El Sauce
Distrito de Lislique
Distrito de Nueva Esparta
Distrito de Pasaquina
Distrito de Polorós
Distrito de San José La Fuente
Distrito de Santa Rosa de Lima
Municipio de La Unión Sur
Distrito de Conchagua
Distrito de El Carmen
Distrito de Intipucá
Distrito de La Unión
Distrito de Meanguera del Golfo
Distrito de San Alejo
Distrito de Yayantique
Distrito de Yucuaiquín
DEPARTAMENTO DE USULUTÁN
Municipio de Usulután Norte
Distrito de Santiago de María
Distrito de Alegría
Distrito de Berlín
Distrito de Mercedes Umana
Distrito de Jucuapa
Distrito de El Triunfo
Distrito de Estanzuelas
Distrito de San Buenaventura
Distrito de Nueva Granada
Municipio de Usulután Este
Distrito de Usulután
Distrito de Jucuarán
Distrito de San Dionisio
Distrito de Concepción Batres
Distrito de Santa María
Distrito de Ozatlán
Distrito de Tecapán
Distrito de Santa Elena
Distrito de California
Distrito de Ereguayquín
Municipio de Usulután Oeste
Distrito de Jiquilisco
Distrito de Puerto El Triunfo
Distrito de San Agustín
Distrito de San Francisco Javier
DEPARTAMENTO DE SONSONATE
Municipio de Sonsonate Norte
Distrito de Juayúa
Distrito de Nahuizalco
Distrito de Salcoatitán
Distrito de Santa Catarina Masahuat
Municipio de Sonsonate Centro
Distrito de Sonsonate
Distrito de Sonzacate
Distrito de Nahulingo
Distrito de San Antonio del Monte
Distrito de Santo Domingo de Guzmán
Municipio de Sonsonate Este
Distrito de Izalco
Distrito de Armenia
Distrito de Caluco
Distrito de San Julián
Distrito de Cuisnahuat
Distrito de Santa Isabel Ishuatán
Municipio de Sonsonate Oeste
Distrito de Acajutla
DEPARTAMENTO DE SANTA ANA
Municipio de Santa Ana Norte
Distrito de Masahuat
Distrito de Metapán
Distrito de Santa Rosa Guachipilín
Distrito de Texistepeque
Municipio de Santa Ana Centro
Distrito de Santa Ana
Municipio de Santa Ana Este
Distrito de Coatepeque
Distrito de El Congo
Municipio de Santa Ana Oeste
Distrito de Candelaria de la Frontera
Distrito de Chalchuapa
Distrito de El Porvenir
Distrito de San Antonio Pajonal
Distrito de San Sebastián Salitrillo
Distrito de Santiago de La Frontera
DEPARTAMENTO DE SAN VICENTE
Municipio de San Vicente Norte
Distrito de Apastepeque
Distrito de Santa Clara
Distrito de San Ildefonso
Distrito de San Esteban Catarina
Distrito de San Sebastián
Distrito de San Lorenzo
Distrito de Santo Domingo
Municipio de San Vicente Sur
Distrito de San Vicente
Distrito de Guadalupe
Distrito de Verapaz
Distrito de Tepetitán
Distrito de Tecoluca
Distrito de San Cayetano Istepeque
DEPARTAMENTO DE SAN MIGUEL
Municipio de San Miguel Norte
Distrito de Ciudad Barrios
Distrito de Sesori
Distrito de Nuevo Edén de San Juan
Distrito de San Gerardo
Distrito de San Luis de La Reina
Distrito de Carolina
Distrito de San Antonio del Mosco
Distrito de Chapeltique
Municipio de San Miguel Centro
Distrito de San Miguel
Distrito de Comacarán
Distrito de Uluazapa
Distrito de Moncagua
Distrito de Quelepa
Distrito de Chirilagua
Municipio de San Miguel Oeste
Distrito de Chinameca
Distrito de Nueva Guadalupe
Distrito de Lolotique
Distrito de San Jorge
Distrito de San Rafael Oriente
Distrito de El Tránsito
DEPARTAMENTO DE MORAZÁN
Municipio de Morazán Norte
Distrito de Arambala
Distrito de Cacaopera
Distrito de Corinto
Distrito de El Rosario
Distrito de Joateca
Distrito de Jocoaitique
Distrito de Meanguera
Distrito de Perquín
Distrito de San Fernando
Distrito de San Isidro
Distrito de Torola
Municipio de Morazán Sur
Distrito de Chilanga
Distrito de Delicias de Concepción
Distrito de El Divisadero
Distrito de Gualococti
Distrito de Guatajiagua
Distrito de Jocoro
Distrito de Lolotiquillo
Distrito de Osicala
Distrito de San Carlos
Distrito de San Francisco Gotera
Distrito de San Simón
Distrito de Sensembra
Distrito de Sociedad
Distrito de Yamabal
Distrito de Yoloaiquín
`;

function normalizeKey(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMunicipioName(name) {
  return normalizeKey(name.replace(/^Municipio de /i, ''));
}

function normalizeDistritoValor(name) {
  return name
    .replace(/^Distrito de /i, '')
    .trim()
    .toUpperCase();
}

function lookupOfficialMunicipioCode(departamentoCodigo, municipioValor) {
  const key = `${departamentoCodigo}|${normalizeKey(municipioValor)}`;
  const alias = MUNICIPIO_ZONE_ALIASES[key];
  if (alias) return pad2(alias);
  const codigo = officialMunicipioCodes.get(key);
  if (!codigo) throw new Error(`Codigo municipio MH faltante: ${key}`);
  return codigo;
}

function lookupOfficialDistritoCode(departamentoCodigo, distritoValor, fallbackCodigo) {
  const target = normalizeKey(distritoValor);
  const direct = distritoCodigoByDeptName.get(`${departamentoCodigo}|${target}`);
  if (direct) return direct;

  const DISTRITO_ALIASES = {
    '05|SANTA TECLA': '01',
    '05|SAN JOSE VILLANUEVA': '15',
    '05|HUIZUCAR': '08',
    '05|CHILTUIPAN': '07',
    '06|SAN MARTIN': '14',
    '06|CIUDAD DELGADO': '19',
    '06|ROSARIO DE MORA': '12',
    '06|SANTO TOMAS': '16',
  };
  const alias = DISTRITO_ALIASES[`${departamentoCodigo}|${target}`];
  if (alias) return pad2(alias);

  for (const [key, codigo] of distritoCodigoByDeptName.entries()) {
    if (!key.startsWith(`${departamentoCodigo}|`)) continue;
    const name = key.slice(3);
    if (name.includes(target) || target.includes(name)) return codigo;
  }

  return pad2(fallbackCodigo);
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseHierarchy(raw) {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let currentDept = null;
  let currentMuni = null;
  const municipios = [];
  const distritos = [];

  for (const line of lines) {
    if (line.startsWith('DEPARTAMENTO DE ')) {
      currentDept = DEPT_CODES[line] ?? null;
      currentMuni = null;
      continue;
    }
    if (line.startsWith('Municipio de ')) {
      const valor = normalizeMunicipioName(line);
      const codigo = lookupOfficialMunicipioCode(currentDept, valor);
      currentMuni = { departamento_codigo: currentDept, codigo, valor };
      municipios.push(currentMuni);
      continue;
    }
    if (line.startsWith('Distrito de ')) {
      if (!currentMuni) throw new Error(`Distrito sin municipio: ${line}`);
      const valor = normalizeDistritoValor(line);
      const fallbackSeq =
        distritos.filter(
          (d) =>
            d.departamento_codigo === currentMuni.departamento_codigo &&
            d.municipio_codigo === currentMuni.codigo
        ).length + 1;
      const codigo = lookupOfficialDistritoCode(
        currentMuni.departamento_codigo,
        valor,
        fallbackSeq
      );
      distritos.push({
        departamento_codigo: currentMuni.departamento_codigo,
        municipio_codigo: currentMuni.codigo,
        codigo,
        valor,
      });
    }
  }

  return { municipios, distritos };
}

const { municipios: parsedMunicipios, distritos } = parseHierarchy(RAW);

const municipios = [];
const seenMunicipios = new Set();
for (const muni of parsedMunicipios) {
  const key = `${muni.departamento_codigo}|${muni.codigo}`;
  if (seenMunicipios.has(key)) continue;
  seenMunicipios.add(key);
  municipios.push(muni);
}

const dedupedDistritos = [];
const seenDistritos = new Set();
for (const distrito of distritos) {
  let codigo = distrito.codigo;
  let key = `${distrito.departamento_codigo}|${distrito.municipio_codigo}|${codigo}`;
  let seq = Number(codigo);
  while (seenDistritos.has(key)) {
    seq += 1;
    codigo = pad2(seq);
    key = `${distrito.departamento_codigo}|${distrito.municipio_codigo}|${codigo}`;
  }
  seenDistritos.add(key);
  dedupedDistritos.push({ ...distrito, codigo });
}
const distritosFinal = dedupedDistritos;

/** CAT-013 oficial MH: codigo global 2 digitos (sin columna padre en BD). */
const municipiosFlat = mhCatalog.catalogo.cat013.municipios
  .filter((m) => pad2(m.codigoDepartamento) !== '00')
  .map((m) => ({
    codigo: pad2(m.codigo),
    valor: String(m.nombre).trim().toUpperCase(),
    departamento_codigo: pad2(m.codigoDepartamento),
  }));

/** CAT-008: 262 distritos geograficos; codigo unico 4 digitos (dept + distrito DTE). */
const distritosFlat = [];
for (const dept of mhDistritos262.departamentos) {
  for (const distrito of dept.municipios) {
    distritosFlat.push({
      codigo: String(distrito.codigo).padStart(4, '0'),
      valor: String(distrito.nombre).trim().toUpperCase(),
    });
  }
}

const municipioDepartamento = Object.fromEntries(
  municipiosFlat.map((m) => [m.codigo, m.departamento_codigo])
);

/** Zona CAT-013 por codigo geografico 4 digitos (de LERM + codigos MH). */
const distritoGeoZona = {};
for (const distrito of distritosFinal) {
  const geo = `${distrito.departamento_codigo}${pad2(distrito.codigo)}`;
  distritoGeoZona[geo] = distrito.municipio_codigo;
}

const zonaDistritos = {};
for (const [geo, zona] of Object.entries(distritoGeoZona)) {
  const suffix = geo.slice(-2);
  if (!zonaDistritos[zona]) zonaDistritos[zona] = [];
  if (!zonaDistritos[zona].includes(suffix)) zonaDistritos[zona].push(suffix);
}
for (const zona of Object.keys(zonaDistritos)) {
  zonaDistritos[zona].sort();
}

const ubicacionMaps = {
  municipioDepartamento,
  distritoGeoZona,
  zonaDistritos,
};

const mapsOutPath = path.join(
  process.cwd(),
  'verificador-dte',
  'lib',
  'facturacion',
  'data',
  'ubicacion-maps.json'
);
fs.mkdirSync(path.dirname(mapsOutPath), { recursive: true });
fs.writeFileSync(mapsOutPath, `${JSON.stringify(ubicacionMaps, null, 2)}\n`, 'utf8');

const deptInserts = [
  `('00', 'Otro (Para extranjeros)')`,
  ...Object.entries(DEPT_VALORES).map(([codigo, valor]) => `('${codigo}', '${sqlEscape(valor)}')`),
];

const muniInserts = municipiosFlat.map(
  (m) => `('${m.codigo}', '${sqlEscape(m.valor)}')`
);

const distInserts = distritosFlat.map(
  (d) => `('${d.codigo}', '${sqlEscape(d.valor)}')`
);

const sql = `-- ============================================================
-- CATÁLOGOS DE UBICACIÓN PLANOS (CAT-012, CAT-013, CAT-008)
-- Generado por scripts/generate-ubicacion-flat-sql.mjs
-- Solo codigo + valor en cada tabla (sin cascada en BD).
-- DTE Hacienda: departamento/municipio/distrito = 2 digitos c/u en emisores/clientes.
-- ============================================================

DROP VIEW IF EXISTS vista_ubicacion_cascada;
DROP TABLE IF EXISTS cat_008_distritos CASCADE;
DROP TABLE IF EXISTS cat_008_districts CASCADE;
DROP TABLE IF EXISTS cat_008_district CASCADE;
DROP TABLE IF EXISTS cat_006_municipios CASCADE;
DROP TABLE IF EXISTS cat_005_departamentos CASCADE;
DROP TABLE IF EXISTS cat_013_municipalities CASCADE;
DROP TABLE IF EXISTS cat_012_departments CASCADE;
DROP TABLE IF EXISTS cat_012_department CASCADE;
DROP TABLE IF EXISTS cat_008_distrito CASCADE;
DROP TABLE IF EXISTS cat_013_municipio CASCADE;
DROP TABLE IF EXISTS cat_012_departamento CASCADE;

-- CAT-012 Departamento
CREATE TABLE cat_012_departamento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL,
    valor TEXT NOT NULL,
    UNIQUE (codigo)
);

-- CAT-013 Municipio (codigo MH global 2 digitos)
CREATE TABLE cat_013_municipio (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL,
    valor TEXT NOT NULL,
    UNIQUE (codigo)
);

-- CAT-008 Distrito (codigo geografico unico 4 digitos: dept + distrito DTE)
CREATE TABLE cat_008_distrito (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL,
    valor TEXT NOT NULL,
    UNIQUE (codigo)
);

INSERT INTO cat_012_departamento (codigo, valor) VALUES
${deptInserts.join(',\n')};

INSERT INTO cat_013_municipio (codigo, valor) VALUES
${muniInserts.join(',\n')};

INSERT INTO cat_008_distrito (codigo, valor) VALUES
${distInserts.join(',\n')};
`;

const outPath = path.join(process.cwd(), 'scripts', 'fix-ubicacion-flat.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`OK: ${outPath}`);
console.log(`OK: ${mapsOutPath}`);
console.log(`Departamentos: ${deptInserts.length}`);
console.log(`Municipios: ${municipiosFlat.length}`);
console.log(`Distritos: ${distritosFlat.length}`);
