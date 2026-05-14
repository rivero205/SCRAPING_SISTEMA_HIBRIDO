const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "data", "barrios.db");
const OUT_DIR = path.join(__dirname, "..", "data", "weka");
const CSV_PATH = path.join(OUT_DIR, "propiedades_weka.csv");
const ARFF_PATH = path.join(OUT_DIR, "propiedades_weka.arff");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function toCsvValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "?";
  }
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toArffValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "?";
  }
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "\\'")}'`;
}

function toArffNominalList(values) {
  const escaped = values.map((value) => `'${String(value).replace(/'/g, "\\'")}'`);
  return `{${escaped.join(",")}}`;
}

function priceRange(value, q1, q2, q3) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (value <= q1) return "bajo";
  if (value <= q2) return "medio";
  if (value <= q3) return "alto";
  return "premium";
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No se encontro la base de datos en ${DB_PATH}`);
    process.exit(1);
  }

  ensureDir(OUT_DIR);

  const db = new Database(DB_PATH, { readonly: true });

  const rows = db
    .prepare(
      `
      SELECT
        p.precio_arriendo_cop AS precio_arriendo_cop,
        p.admin_cop AS admin_cop,
        p.area_m2 AS area_m2,
        p.habitaciones AS habitaciones,
        p.banos AS banos,
        p.parqueaderos AS parqueaderos,
        p.tipo_inmueble AS tipo_inmueble,
        b.estrato AS barrio_estrato,
        b.area_km2 AS barrio_area_km2,
        b.estado_pavimento AS barrio_estado_pavimento,
        b.iluminacion_led AS barrio_iluminacion_led
      FROM propiedades p
      JOIN barrios b ON p.barrio_id = b.id
      WHERE p.precio_arriendo_cop IS NOT NULL
      `
    )
    .all();

  if (rows.length === 0) {
    console.error("No hay registros de propiedades para exportar.");
    process.exit(1);
  }

  const prices = rows
    .map((row) => row.precio_arriendo_cop)
    .filter((value) => typeof value === "number")
    .sort((a, b) => a - b);

  const q1 = percentile(prices, 0.25);
  const q2 = percentile(prices, 0.5);
  const q3 = percentile(prices, 0.75);

  const dataset = rows.map((row) => ({
    ...row,
    precio_rango: priceRange(row.precio_arriendo_cop, q1, q2, q3),
  }));

  const headers = [
    "precio_arriendo_cop",
    "admin_cop",
    "area_m2",
    "habitaciones",
    "banos",
    "parqueaderos",
    "tipo_inmueble",
    "barrio_estrato",
    "barrio_area_km2",
    "barrio_estado_pavimento",
    "barrio_iluminacion_led",
    "precio_rango",
  ];

  const csvLines = [headers.join(",")];
  for (const row of dataset) {
    const values = headers.map((header) => toCsvValue(row[header]));
    csvLines.push(values.join(","));
  }

  fs.writeFileSync(CSV_PATH, csvLines.join("\n"), "utf8");

  const tipoInmuebleSet = new Set();
  const pavimentoSet = new Set();
  const rangoSet = new Set();

  for (const row of dataset) {
    if (row.tipo_inmueble) tipoInmuebleSet.add(row.tipo_inmueble);
    if (row.barrio_estado_pavimento) pavimentoSet.add(row.barrio_estado_pavimento);
    if (row.precio_rango) rangoSet.add(row.precio_rango);
  }

  const arffLines = [
    "@RELATION propiedades",
    "",
    "@ATTRIBUTE precio_arriendo_cop NUMERIC",
    "@ATTRIBUTE admin_cop NUMERIC",
    "@ATTRIBUTE area_m2 NUMERIC",
    "@ATTRIBUTE habitaciones NUMERIC",
    "@ATTRIBUTE banos NUMERIC",
    "@ATTRIBUTE parqueaderos NUMERIC",
    `@ATTRIBUTE tipo_inmueble ${toArffNominalList(Array.from(tipoInmuebleSet))}`,
    "@ATTRIBUTE barrio_estrato NUMERIC",
    "@ATTRIBUTE barrio_area_km2 NUMERIC",
    `@ATTRIBUTE barrio_estado_pavimento ${toArffNominalList(Array.from(pavimentoSet))}`,
    "@ATTRIBUTE barrio_iluminacion_led {0,1}",
    `@ATTRIBUTE precio_rango ${toArffNominalList(Array.from(rangoSet))}`,
    "",
    "@DATA",
  ];

  for (const row of dataset) {
    const values = headers.map((header) => toArffValue(row[header]));
    arffLines.push(values.join(","));
  }

  fs.writeFileSync(ARFF_PATH, arffLines.join("\n"), "utf8");

  db.close();

  console.log(`CSV generado en: ${CSV_PATH}`);
  console.log(`ARFF generado en: ${ARFF_PATH}`);
  console.log(
    `Rangos de precio (COP): Q1=${Math.round(q1)}, Q2=${Math.round(q2)}, Q3=${Math.round(q3)}`
  );
}

main();
