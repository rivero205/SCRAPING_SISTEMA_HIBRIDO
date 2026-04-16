/**
 * =========================================================
 *  Pipeline: Scraping → ETL → SQLite
 *
 *  Lee los barrios de la base de datos, scrapea Fincaraiz,
 *  limpia los datos y guarda las propiedades en la tabla
 *  `propiedades` relacionadas por barrio_id.
 * =========================================================
 *  Requisito: los barrios deben estar en la BD.
 *    npm run sync     (carga barrios.json → BD)
 *    npm run scraping (ejecuta este pipeline)
 * =========================================================
 */

const db = require("../src/config/database");
const { ejecutarScraping } = require("./scraper");
const { ejecutarETL } = require("./etl");

async function main() {
  const inicio = Date.now();

  console.log("=".repeat(55));
  console.log("  PIPELINE — SCRAPING + ETL → SQLite");
  console.log("  Cartagena de Indias — Fincaraiz");
  console.log("=".repeat(55));

  // 1. Inicializar BD
  db.inicializar();

  // 2. Obtener barrios de la BD
  const barrios = db.obtenerBarriosParaScraping();

  if (barrios.length === 0) {
    console.error("\n  ❌ No hay barrios en la base de datos.");
    console.error("  Ejecuta primero: npm run sync");
    db.cerrar();
    process.exit(1);
  }

  console.log(`\n  Barrios en BD: ${barrios.length}`);
  console.log(
    "  Ejemplos: " +
      barrios
        .slice(0, 5)
        .map((b) => `${b.nombre} (${b.slug})`)
        .join(", ") +
      "..."
  );
  console.log();

  // 3. Scraping — extrae datos crudos de Fincaraiz
  const registrosCrudos = await ejecutarScraping(barrios);

  if (registrosCrudos.length === 0) {
    console.log("\n  ⚠  No se obtuvieron registros del scraping.");
    db.cerrar();
    return;
  }

  // 4. ETL — limpia y estructura los datos
  const { propiedades, descartados } = ejecutarETL(registrosCrudos);

  if (propiedades.length === 0) {
    console.log("\n  ⚠  Ninguna propiedad pasó la validación ETL.");
    db.cerrar();
    return;
  }

  // 5. Guardar en BD (elimina propiedades anteriores y re-inserta)
  console.log("\n  Guardando en base de datos...");
  const eliminados = db.limpiarPropiedades();
  if (eliminados > 0) {
    console.log(`  🗑  ${eliminados} propiedades anteriores eliminadas`);
  }

  const resultado = db.insertarPropiedades(propiedades);
  console.log(`  ✅ ${resultado.insertados} propiedades insertadas en SQLite`);

  if (resultado.errores.length > 0) {
    console.log(`  ⚠  ${resultado.errores.length} errores al insertar`);
  }

  // 6. Resumen final
  const duracion = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(55));
  console.log("  ✅ PIPELINE COMPLETADO");
  console.log("=".repeat(55));
  console.log(`  Barrios procesados : ${barrios.length}`);
  console.log(`  Registros crudos   : ${registrosCrudos.length}`);
  console.log(`  Propiedades válidas: ${propiedades.length}`);
  console.log(`  Descartados        : ${descartados}`);
  console.log(`  Guardados en BD    : ${resultado.insertados}`);
  console.log(`  Total en BD        : ${db.contarPropiedades()}`);
  console.log(`  Tiempo total       : ${duracion}s`);
  console.log("=".repeat(55));

  db.cerrar();
}

main().catch((err) => {
  console.error("  ❌ Error inesperado:", err.message);
  try {
    db.cerrar();
  } catch (_) {}
  process.exit(1);
});
