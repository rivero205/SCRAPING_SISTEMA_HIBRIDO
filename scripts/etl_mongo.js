/**
 * =========================================================
 *  ELT — SQLite → MongoDB Atlas
 *
 *  1. EXTRACT  — Lee barrios y propiedades de SQLite
 *  2. LOAD     — Inserta documentos crudos en MongoDB
 *  3. TRANSFORM — Agrega campo `conclusion` con análisis
 *                 BI real basado en estadísticas agregadas
 *
 *  Colecciones:
 *    · barrios_bi       — un doc por barrio
 *    · propiedades_bi   — un doc por propiedad
 * =========================================================
 *  Uso: npm run etl:mongo
 * =========================================================
 */

"use strict";

const { MongoClient } = require("mongodb");
const db = require("../src/config/database");

const MONGO_URI = "mongodb+srv://maicolandresviverorios_db_user:n9exqaCUZlUyZC8j@cluster0.drxdpsj.mongodb.net/?appName=Cluster0";
const MONGO_DB  = "cartagena_bi";

// ─── Utilidades estadísticas ─────────────────────────────

const mean   = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentil = (valor, arr) => {
  if (!arr.length || valor == null) return null;
  const menores = arr.filter((v) => v < valor).length;
  return Math.round((menores / arr.length) * 100);
};
const fmt = (n) => n != null ? Math.round(n).toLocaleString("es-CO") : "N/A";

// ─── Cálculo de estadísticas globales y por barrio ───────

function calcularEstadisticas(barrios, propiedades) {
  // Precios válidos para análisis
  const conPrecio   = propiedades.filter((p) => p.precio_arriendo_cop > 0);
  const conPrecioM2 = conPrecio.filter((p) => p.area_m2 > 0);

  const preciosGlobales  = conPrecio.map((p) => p.precio_arriendo_cop);
  const preciosM2Global  = conPrecioM2.map((p) => p.precio_arriendo_cop / p.area_m2);

  const global = {
    totalPropiedades   : propiedades.length,
    totalBarrios       : barrios.length,
    avgPrecio          : mean(preciosGlobales),
    medianPrecio       : median(preciosGlobales),
    avgPrecioM2        : mean(preciosM2Global),
    avgPropsXBarrio    : propiedades.length / barrios.length,
    todosPreciosM2     : preciosM2Global,   // para percentiles de propiedades
    todosPreciosBarrio : [],                // se llena abajo
  };

  // Stats por barrio
  const statsPorBarrio = {};
  for (const b of barrios) {
    const props   = conPrecio.filter((p) => p.barrio_id === b.id);
    const propsM2 = props.filter((p) => p.area_m2 > 0);

    statsPorBarrio[b.id] = {
      count      : propiedades.filter((p) => p.barrio_id === b.id).length,
      avgPrecio  : mean(props.map((p) => p.precio_arriendo_cop)),
      avgPrecioM2: mean(propsM2.map((p) => p.precio_arriendo_cop / p.area_m2)),
    };
  }

  // Lista de avgPrecio por barrio (para percentiles de barrios)
  global.todosPreciosBarrio = Object.values(statsPorBarrio)
    .map((s) => s.avgPrecio)
    .filter(Boolean);

  // Correlación infraestructura: EXCELENTE (bueno+LED) vs el resto
  const idsExcelente = barrios
    .filter((b) => b.estado_pavimento === "BUENO" && b.iluminacion_led === 1)
    .map((b) => b.id);
  const idsResto = barrios
    .filter((b) => !(b.estado_pavimento === "BUENO" && b.iluminacion_led === 1))
    .map((b) => b.id);

  const preciosExcelente = conPrecio.filter((p) => idsExcelente.includes(p.barrio_id)).map((p) => p.precio_arriendo_cop);
  const preciosResto     = conPrecio.filter((p) => idsResto.includes(p.barrio_id)).map((p) => p.precio_arriendo_cop);

  global.avgPrecioInfraExcelente = mean(preciosExcelente);
  global.avgPrecioInfraResto     = mean(preciosResto);
  global.correlacionInfraPorc    = global.avgPrecioInfraExcelente && global.avgPrecioInfraResto
    ? Math.round(((global.avgPrecioInfraExcelente - global.avgPrecioInfraResto) / global.avgPrecioInfraResto) * 100)
    : null;

  return { global, statsPorBarrio };
}

// ─── Conclusión BI por BARRIO ─────────────────────────────
// Pregunta que responde: ¿Hay sobreoferta o escasez en esta zona?

function conclusionBarrio(b, stats, global) {
  const s         = stats[b.id] || {};
  const count     = s.count ?? 0;
  const avgProps  = Math.round(global.avgPropsXBarrio);
  const ratio     = avgProps > 0 ? count / avgProps : null;

  if (count === 0) {
    return `${b.nombre} no registra propiedades en arriendo durante el período de scraping, lo que puede indicar escasez real de oferta o ausencia del barrio en plataformas digitales — zona con dato insuficiente para análisis de mercado.`;
  }

  // Diagnóstico de oferta
  const diagnostico = ratio > 2
    ? `con ${count} propiedades disponibles, más del doble de la media de Cartagena (${avgProps} por barrio), lo que evidencia una sobreoferta clara`
    : ratio < 0.5
      ? `con solo ${count} propiedades disponibles, muy por debajo de la media de la ciudad (${avgProps} por barrio), lo que refleja escasez de oferta`
      : `con ${count} propiedades disponibles, en línea con la media de Cartagena (${avgProps} por barrio), lo que refleja un mercado equilibrado`;

  // Comportamiento del precio ante esa oferta
  let comportamientoPrecio = "";
  if (s.avgPrecio && global.avgPrecio) {
    const diff = Math.round(((s.avgPrecio - global.avgPrecio) / global.avgPrecio) * 100);
    const signo = diff > 0 ? "por encima" : "por debajo";
    const magnitud = Math.abs(diff);
    if (ratio > 2 && diff <= 0) {
      comportamientoPrecio = `A pesar de la sobreoferta, el arriendo promedio de $${fmt(s.avgPrecio)} COP está ${magnitud}% ${signo} de la media de la ciudad, lo cual es coherente: a mayor oferta, menor precio.`;
    } else if (ratio > 2 && diff > 0) {
      comportamientoPrecio = `Sorprendentemente, pese a la sobreoferta, el arriendo promedio de $${fmt(s.avgPrecio)} COP está ${magnitud}% por encima de la media de la ciudad, lo que sugiere que la demanda absorbe bien el inventario disponible.`;
    } else if (ratio < 0.5 && diff > 0) {
      comportamientoPrecio = `La escasez se refleja directamente en el precio: el arriendo promedio de $${fmt(s.avgPrecio)} COP supera en ${magnitud}% la media de la ciudad ($${fmt(global.avgPrecio)} COP), confirmando que poca oferta presiona los precios al alza.`;
    } else {
      comportamientoPrecio = `El arriendo promedio de $${fmt(s.avgPrecio)} COP está ${magnitud}% ${signo} de la media de la ciudad ($${fmt(global.avgPrecio)} COP), dentro de un comportamiento de mercado esperado.`;
    }
  }

  return `${b.nombre} es un barrio de estrato ${b.estrato ?? "?"} ${diagnostico}. ${comportamientoPrecio}`;
}

// ─── Conclusión BI por PROPIEDAD ─────────────────────────
// Pregunta que responde: ¿Es este inmueble económico o caro frente al mercado?

function conclusionPropiedad(p, statsBarrio, global) {
  const s           = statsBarrio[p.barrio_id] || {};
  const precio      = p.precio_arriendo_cop;
  const area        = p.area_m2;
  const precioPorM2 = precio && area > 0 ? precio / area : null;
  const tipo        = p.tipo_inmueble || "inmueble";
  const barrio      = p.barrio_nombre || "este barrio";

  if (!precio) {
    return `Este ${tipo} en ${barrio} no cuenta con precio registrado, por lo que no es posible determinar su posición frente al mercado. Se recomienda excluirlo de análisis cuantitativos hasta obtener el dato.`;
  }

  // Comparación vs promedio del barrio
  let vsBarrio = "";
  if (s.avgPrecio) {
    const diff = Math.round(((precio - s.avgPrecio) / s.avgPrecio) * 100);
    const signo = diff > 0 ? "por encima" : "por debajo";
    if (Math.abs(diff) > 20) {
      vsBarrio = diff > 0
        ? `Su precio de $${fmt(precio)} COP está ${Math.abs(diff)}% por encima del promedio de ${barrio} ($${fmt(s.avgPrecio)} COP), lo que lo posiciona como uno de los más costosos de su zona.`
        : `Su precio de $${fmt(precio)} COP está ${Math.abs(diff)}% por debajo del promedio de ${barrio} ($${fmt(s.avgPrecio)} COP), lo que lo hace notablemente más accesible que la competencia cercana.`;
    } else {
      vsBarrio = `Su precio de $${fmt(precio)} COP se alinea con el promedio de ${barrio} ($${fmt(s.avgPrecio)} COP), con una variación de solo ${Math.abs(diff)}%.`;
    }
  }

  // Comparación por m² vs ciudad
  let vsM2 = "";
  if (precioPorM2 && global.avgPrecioM2) {
    const perc = percentil(precioPorM2, global.todosPreciosM2);
    if (perc <= 20) {
      vsM2 = `A $${fmt(precioPorM2)}/m², se ubica en el percentil ${perc} más económico de toda Cartagena, siendo una opción subvalorada frente al mercado general.`;
    } else if (perc >= 80) {
      vsM2 = `A $${fmt(precioPorM2)}/m², se ubica en el percentil ${perc} más caro de Cartagena, superando significativamente la media de $${fmt(global.avgPrecioM2)}/m².`;
    } else {
      vsM2 = `A $${fmt(precioPorM2)}/m², su precio por metro cuadrado es competitivo y se ubica en el percentil ${perc} de la ciudad, dentro del rango esperado para su tipo.`;
    }
  }

  // Veredicto final natural
  const precioBajoBarrio = s.avgPrecio && precio < s.avgPrecio * 0.8;
  const precioBajoCiudad = precioPorM2 && global.avgPrecioM2 && precioPorM2 < global.avgPrecioM2 * 0.8;
  const precioAltoCiudad = precioPorM2 && global.avgPrecioM2 && precioPorM2 > global.avgPrecioM2 * 1.4;

  let veredicto;
  if (precioBajoBarrio && precioBajoCiudad) {
    veredicto = "En conjunto, representa una oportunidad de arriendo clara: barato frente a su barrio y frente a la ciudad.";
  } else if (precioAltoCiudad) {
    veredicto = "En conjunto, está sobrevalorado frente al mercado de Cartagena; se recomienda negociar el precio antes de comprometerse.";
  } else if (precioBajoBarrio) {
    veredicto = "En conjunto, está por debajo del precio de mercado local, lo que representa una ventaja competitiva para el arrendatario.";
  } else {
    veredicto = "En conjunto, su precio es coherente con las condiciones actuales del mercado en Cartagena.";
  }

  return [vsBarrio, vsM2, veredicto].filter(Boolean).join(" ");
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  const inicio = Date.now();

  console.log("=".repeat(58));
  console.log("  ELT — SQLite → MongoDB Atlas");
  console.log("  Análisis BI · Cartagena de Indias");
  console.log("=".repeat(58));

  // ── EXTRACT ───────────────────────────────────────────
  console.log("\n  [EXTRACT] Leyendo SQLite...");
  db.inicializar();
  const barrios     = db.obtenerTodos();
  const propiedades = db.obtenerPropiedades();
  db.cerrar();
  console.log(`  ✓ ${barrios.length} barrios · ${propiedades.length} propiedades`);

  if (barrios.length === 0) {
    console.error("  ❌ SQLite vacío. Ejecuta: npm run sync && npm run scraping");
    return;
  }

  // ── ESTADÍSTICAS AGREGADAS ────────────────────────────
  console.log("\n  [STATS] Calculando estadísticas globales...");
  const { global: globalStats, statsPorBarrio } = calcularEstadisticas(barrios, propiedades);

  console.log(`  · Precio promedio global    : $${fmt(globalStats.avgPrecio)} COP`);
  console.log(`  · Precio mediana global     : $${fmt(globalStats.medianPrecio)} COP`);
  console.log(`  · Precio/m² promedio        : $${fmt(globalStats.avgPrecioM2)}/m²`);
  console.log(`  · Propiedades/barrio (media): ${Math.round(globalStats.avgPropsXBarrio)}`);
  if (globalStats.correlacionInfraPorc != null) {
    console.log(`  · Infra EXCELENTE vs resto  : +${globalStats.correlacionInfraPorc}% en arriendo`);
  }

  // ── LOAD + TRANSFORM → MongoDB ────────────────────────
  console.log("\n  [LOAD] Conectando a MongoDB Atlas...");
  const cliente = new MongoClient(MONGO_URI);
  await cliente.connect();
  console.log("  ✓ Conectado\n");

  const mongoDB = cliente.db(MONGO_DB);
  const ahora   = new Date().toISOString();

  // ── barrios_bi ────────────────────────────────────────
  console.log("  Cargando barrios_bi...");
  const colBarrios = mongoDB.collection("barrios_bi");
  await colBarrios.deleteMany({});

  const docsBarrios = barrios.map((b) => ({
    sqlite_id        : b.id,
    nombre           : b.nombre,
    slug             : b.slug,
    estrato          : b.estrato,
    latitud          : b.latitud,
    longitud         : b.longitud,
    area_km2         : b.area_km2,
    estado_pavimento : b.estado_pavimento,
    iluminacion_led  : b.iluminacion_led === 1,
    fecha_insercion  : b.fecha_insercion,
    // Stats calculadas del barrio (para BI en Mongo)
    total_propiedades_scraped : statsPorBarrio[b.id]?.count ?? 0,
    avg_precio_cop            : statsPorBarrio[b.id]?.avgPrecio    ? Math.round(statsPorBarrio[b.id].avgPrecio)    : null,
    avg_precio_m2             : statsPorBarrio[b.id]?.avgPrecioM2  ? Math.round(statsPorBarrio[b.id].avgPrecioM2)  : null,
    _fuente      : "sqlite:barrios",
    _fecha_carga : ahora,
    conclusion   : conclusionBarrio(b, statsPorBarrio, globalStats),
  }));

  await colBarrios.insertMany(docsBarrios);
  console.log(`  ✓ ${docsBarrios.length} docs en barrios_bi`);

  // ── propiedades_bi ────────────────────────────────────
  console.log("  Cargando propiedades_bi...");
  const colProps = mongoDB.collection("propiedades_bi");
  await colProps.deleteMany({});

  if (propiedades.length > 0) {
    const docsPropiedades = propiedades.map((p) => ({
      sqlite_id           : p.id,
      tipo_inmueble       : p.tipo_inmueble,
      precio_arriendo_cop : p.precio_arriendo_cop,
      admin_cop           : p.admin_cop,
      area_m2             : p.area_m2,
      habitaciones        : p.habitaciones,
      banos               : p.banos,
      parqueaderos        : p.parqueaderos,
      titulo              : p.titulo,
      descripcion         : p.descripcion,
      badge               : p.badge,
      link                : p.link,
      pagina_scraping     : p.pagina_scraping,
      url_fuente          : p.url_fuente,
      fecha_scraping      : p.fecha_scraping,
      hora_scraping       : p.hora_scraping,
      barrio_id           : p.barrio_id,
      barrio_nombre       : p.barrio_nombre,
      barrio_estrato      : p.barrio_estrato,
      precio_por_m2       : p.precio_arriendo_cop && p.area_m2 > 0
                              ? Math.round(p.precio_arriendo_cop / p.area_m2)
                              : null,
      _fuente      : "sqlite:propiedades",
      _fecha_carga : ahora,
      conclusion   : conclusionPropiedad(p, statsPorBarrio, globalStats),
    }));

    // Insertar en lotes para no sobrecargar la conexión
    const LOTE = 500;
    for (let i = 0; i < docsPropiedades.length; i += LOTE) {
      await colProps.insertMany(docsPropiedades.slice(i, i + LOTE));
    }
    console.log(`  ✓ ${docsPropiedades.length} docs en propiedades_bi`);
  }

  // ── Resumen ───────────────────────────────────────────
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(58));
  console.log("  ✅ ELT COMPLETADO");
  console.log("=".repeat(58));
  console.log(`  barrios_bi     : ${docsBarrios.length} docs`);
  console.log(`  propiedades_bi : ${propiedades.length} docs`);
  console.log(`  Tiempo         : ${seg}s`);
  console.log("=".repeat(58));

  // Ejemplos reales
  const ejBarrio = docsBarrios.find((b) => b.total_propiedades_scraped > 0);
  if (ejBarrio) {
    console.log(`\n  Barrio: ${ejBarrio.nombre}`);
    console.log(`  → ${ejBarrio.conclusion}`);
  }

  const ejProp = propiedades.find((p) => p.precio_arriendo_cop > 0 && p.area_m2 > 0);
  if (ejProp) {
    console.log(`\n  Propiedad: ${ejProp.titulo?.substring(0, 50)}`);
    console.log(`  → ${conclusionPropiedad(ejProp, statsPorBarrio, globalStats)}`);
  }

  await cliente.close();
}

main().catch((err) => {
  console.error("\n  ❌ Error:", err.message);
  try { db.cerrar(); } catch (_) {}
  process.exit(1);
});
