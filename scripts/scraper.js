/**
 * =========================================================
 *  Módulo de Scraping — Fincaraiz Cartagena
 *  Lee los barrios desde SQLite y extrae datos crudos.
 * =========================================================
 *  No se ejecuta directamente. Es invocado por pipeline.js
 * =========================================================
 */

const axios = require("axios");
const cheerio = require("cheerio");

// ─────────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────────

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "es-CO,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const BASE_URL = "https://www.fincaraiz.com.co/arriendo/{slug}/cartagena";
const PAUSA_MS = 1500;
const MAX_PAGINAS = 3;

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function timestamp() {
  const now = new Date();
  return {
    fecha: now.toISOString().split("T")[0],
    hora: now.toTimeString().split(" ")[0],
  };
}

// ─────────────────────────────────────────────
//  SCRAPING — Extracción de texto crudo
// ─────────────────────────────────────────────

/**
 * Descarga el HTML de una página y extrae texto crudo
 * de cada tarjeta. Cada registro incluye barrio_id para
 * la relación con la tabla barrios.
 */
async function scrapearPagina(barrio, pagina = 1) {
  let url = BASE_URL.replace("{slug}", barrio.slug);
  if (pagina > 1) url += `?pagina=${pagina}`;

  console.log(`  → GET ${url}`);

  let html;
  try {
    const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    html = response.data;
  } catch (err) {
    const codigo = err.response?.status || "sin respuesta";
    console.log(`  ⚠ Error ${codigo}: ${url}`);
    return [];
  }

  const $ = cheerio.load(html);
  const tarjetas = $("div.listingCard");
  const registrosCrudos = [];
  const { fecha, hora } = timestamp();

  tarjetas.each((_, tarjeta) => {
    const card = $(tarjeta);

    const precio_raw = card.find("p.main-price").text().trim() || null;
    const admin_raw = card.find("[class*='commonExpenses']").text().trim() || null;

    const titulo_el =
      card.find("[class*='lc-title']").first() ||
      card.find("h2").first() ||
      card.find("h3").first();
    const titulo_raw = titulo_el.text().trim() || null;

    const descripcion_raw = card.find("p.lc-description").text().trim() || null;
    const link_raw = card.find("a[href]").attr("href") || null;
    const badge_raw =
      card.find("[class*='badge'], [class*='label-tag']").text().trim() || null;
    const texto_completo = card.text().replace(/\s+/g, " ").trim();

    registrosCrudos.push({
      barrio_id: barrio.id,
      barrio_slug: barrio.slug,
      pagina,
      url_fuente: url,
      precio_raw,
      admin_raw,
      titulo_raw,
      descripcion_raw,
      link_raw,
      badge_raw,
      texto_completo,
      fecha_scraping: fecha,
      hora_scraping: hora,
    });
  });

  console.log(`     ✅ ${registrosCrudos.length} tarjetas encontradas`);
  return registrosCrudos;
}

/**
 * Recorre todas las páginas de un barrio.
 */
async function scrapearBarrio(barrio) {
  console.log(`\n📍 ${barrio.nombre.toUpperCase()} (${barrio.slug})`);
  const todos = [];

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const registros = await scrapearPagina(barrio, pagina);
    todos.push(...registros);

    if (registros.length < 21) break;
    await sleep(PAUSA_MS);
  }

  return todos;
}

// ─────────────────────────────────────────────
//  FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────

/**
 * Ejecuta el scraping para todos los barrios recibidos.
 * @param {Array<{id: number, nombre: string, slug: string}>} barrios
 * @returns {Promise<Array>} registros crudos con barrio_id
 */
async function ejecutarScraping(barrios) {
  console.log("=".repeat(50));
  console.log("  SCRAPING — Fincaraiz Cartagena");
  console.log("=".repeat(50));
  console.log(`  Barrios    : ${barrios.length}`);
  console.log(`  Págs/barrio: ${MAX_PAGINAS}`);
  console.log("=".repeat(50));

  const todosLosRegistros = [];

  for (const barrio of barrios) {
    const registros = await scrapearBarrio(barrio);
    todosLosRegistros.push(...registros);
    await sleep(PAUSA_MS);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`  ✅ ${todosLosRegistros.length} registros crudos obtenidos`);
  console.log("=".repeat(50));

  return todosLosRegistros;
}

module.exports = { ejecutarScraping };
