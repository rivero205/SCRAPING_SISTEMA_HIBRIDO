"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const PROJECT_ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(PROJECT_ROOT, "data", "barrios.db");
const OUT_DIR = path.join(PROJECT_ROOT, "data", "powerbi");

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const text = String(value);
  const mustQuote = /[",\n\r]/.test(text);
  if (!mustQuote) return text;

  return '"' + text.replace(/"/g, '""') + '"';
}

function writeCsv({ filePath, headers, rows }) {
  const lines = [];
  lines.push(headers.join(","));

  for (const row of rows) {
    const line = headers.map((h) => csvEscape(row[h])).join(",");
    lines.push(line);
  }

  // BOM UTF-8 para compatibilidad con Excel/Power BI (acentos)
  const bom = "\ufeff";
  fs.writeFileSync(filePath, bom + lines.join("\r\n"), "utf8");
}

function ensureDbExistsOrExit() {
  if (fs.existsSync(DB_PATH)) return;

  console.error(
    [
      "No se encontró la base de datos SQLite en:",
      `  ${DB_PATH}`,
      "\nGenera la BD primero:",
      "  1) npm install",
      "  2) npm start",
      "  3) npm run sync",
      "  4) npm run scraping",
      "\nLuego vuelve a ejecutar:",
      "  npm run export:powerbi",
    ].join("\n")
  );
  process.exit(1);
}

function main() {
  ensureDbExistsOrExit();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const barriosHeaders = [
    "id",
    "nombre",
    "slug",
    "estrato",
    "latitud",
    "longitud",
    "area_km2",
    "estado_pavimento",
    "iluminacion_led",
    "fecha_insercion",
  ];

  const propiedadesHeaders = [
    "id",
    "barrio_id",
    "tipo_inmueble",
    "precio_arriendo_cop",
    "admin_cop",
    "costo_total_cop",
    "area_m2",
    "habitaciones",
    "banos",
    "parqueaderos",
    "titulo",
    "descripcion",
    "badge",
    "link",
    "pagina_scraping",
    "url_fuente",
    "fecha_scraping",
    "hora_scraping",
    "fecha_insercion",
  ];

  const propiedadesEnriquecidaHeaders = [
    ...propiedadesHeaders,
    "barrio_nombre",
    "barrio_estrato",
    "barrio_latitud",
    "barrio_longitud",
  ];

  const barrios = db
    .prepare(
      `
      SELECT
        id, nombre, slug, estrato, latitud, longitud, area_km2,
        estado_pavimento, iluminacion_led, fecha_insercion
      FROM barrios
      ORDER BY id
    `.trim()
    )
    .all();

  const propiedades = db
    .prepare(
      `
      SELECT
        id,
        barrio_id,
        tipo_inmueble,
        precio_arriendo_cop,
        admin_cop,
        (COALESCE(precio_arriendo_cop, 0) + COALESCE(admin_cop, 0)) AS costo_total_cop,
        area_m2,
        habitaciones,
        banos,
        parqueaderos,
        titulo,
        descripcion,
        badge,
        link,
        pagina_scraping,
        url_fuente,
        fecha_scraping,
        hora_scraping,
        fecha_insercion
      FROM propiedades
      ORDER BY id
    `.trim()
    )
    .all();

  const propiedadesEnriquecida = db
    .prepare(
      `
      SELECT
        p.id,
        p.barrio_id,
        p.tipo_inmueble,
        p.precio_arriendo_cop,
        p.admin_cop,
        (COALESCE(p.precio_arriendo_cop, 0) + COALESCE(p.admin_cop, 0)) AS costo_total_cop,
        p.area_m2,
        p.habitaciones,
        p.banos,
        p.parqueaderos,
        p.titulo,
        p.descripcion,
        p.badge,
        p.link,
        p.pagina_scraping,
        p.url_fuente,
        p.fecha_scraping,
        p.hora_scraping,
        p.fecha_insercion,
        b.nombre AS barrio_nombre,
        b.estrato AS barrio_estrato,
        b.latitud AS barrio_latitud,
        b.longitud AS barrio_longitud
      FROM propiedades p
      JOIN barrios b ON b.id = p.barrio_id
      ORDER BY p.id
    `.trim()
    )
    .all();

  const fechasScraping = db
    .prepare(
      `
      SELECT DISTINCT
        fecha_scraping
      FROM propiedades
      WHERE fecha_scraping IS NOT NULL AND TRIM(fecha_scraping) <> ''
      ORDER BY fecha_scraping
    `.trim()
    )
    .all();

  writeCsv({
    filePath: path.join(OUT_DIR, "dim_barrios.csv"),
    headers: barriosHeaders,
    rows: barrios,
  });

  writeCsv({
    filePath: path.join(OUT_DIR, "fact_propiedades.csv"),
    headers: propiedadesHeaders,
    rows: propiedades,
  });

  writeCsv({
    filePath: path.join(OUT_DIR, "fact_propiedades_enriquecida.csv"),
    headers: propiedadesEnriquecidaHeaders,
    rows: propiedadesEnriquecida,
  });

  writeCsv({
    filePath: path.join(OUT_DIR, "dim_fecha_scraping.csv"),
    headers: ["fecha_scraping"],
    rows: fechasScraping,
  });

  db.close();

  console.log("Export Power BI listo:");
  console.log(`- ${path.join("data", "powerbi", "dim_barrios.csv")}`);
  console.log(`- ${path.join("data", "powerbi", "fact_propiedades.csv")}`);
  console.log(
    `- ${path.join("data", "powerbi", "fact_propiedades_enriquecida.csv")}`
  );
  console.log(`- ${path.join("data", "powerbi", "dim_fecha_scraping.csv")}`);
}

main();
