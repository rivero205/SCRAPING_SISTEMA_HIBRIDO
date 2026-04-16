/**
 * =========================================================
 *  Módulo ETL — Limpieza y transformación de datos
 *  Recibe registros crudos del scraper, limpia, valida
 *  y retorna propiedades estructuradas con barrio_id.
 * =========================================================
 *  No se ejecuta directamente. Es invocado por pipeline.js
 * =========================================================
 */

// ─────────────────────────────────────────────
//  FUNCIONES DE LIMPIEZA
// ─────────────────────────────────────────────

/**
 * "$ 3.500.000" → 3500000
 * "+ $ 250.000 admin" → 250000
 */
function limpiarPrecio(texto) {
  if (!texto) return null;
  const soloNumeros = texto.replace(/[^\d]/g, "");
  return soloNumeros ? parseInt(soloNumeros, 10) : null;
}

/**
 * "Apartamento 65 m² Manga" → 65.0
 */
function extraerAreaM2(texto) {
  if (!texto) return null;
  const match = texto.match(/(\d+[.,]?\d*)\s*m[²2]/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

/**
 * "3 Habitaciones" → 3
 */
function extraerHabitaciones(texto) {
  if (!texto) return null;
  const match = texto.match(/(\d+)\s*[Hh]ab/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * "2 Baños" → 2
 */
function extraerBanos(texto) {
  if (!texto) return null;
  const match = texto.match(/(\d+)\s*[Bb]a[ñn]/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * "1 Parqueadero" → 1
 */
function extraerParqueaderos(texto) {
  if (!texto) return null;
  const match = texto.match(/(\d+)\s*[Pp]arq|(\d+)\s*[Gg]araj/);
  if (!match) return null;
  return parseInt(match[1] || match[2], 10);
}

/**
 * "Apartamento En Arriendo En Manga" → "apartamento"
 */
function detectarTipo(titulo) {
  if (!titulo) return "desconocido";
  const t = titulo.toLowerCase();
  if (t.includes("apartaestudio") || t.includes("estudio")) return "apartaestudio";
  if (t.includes("apartamento") || t.includes("apto")) return "apartamento";
  if (t.includes("casa")) return "casa";
  if (t.includes("oficina")) return "oficina";
  if (t.includes("local")) return "local";
  if (t.includes("bodega")) return "bodega";
  if (t.includes("lote") || t.includes("terreno")) return "lote";
  if (t.includes("finca") || t.includes("villa")) return "finca";
  return "otro";
}

/**
 * Asegura que el link sea absoluto.
 */
function normalizarLink(link) {
  if (!link) return null;
  if (link.startsWith("http")) return link;
  return "https://www.fincaraiz.com.co" + link;
}

/**
 * Arriendo realista en Cartagena: $300.000 – $100.000.000
 */
function precioValido(precio) {
  if (precio === null || precio === undefined) return false;
  return precio >= 300_000 && precio <= 100_000_000;
}

// ─────────────────────────────────────────────
//  TRANSFORMACIÓN
// ─────────────────────────────────────────────

/**
 * Recibe un registro crudo del scraper.
 * Retorna el registro limpio con barrio_id para la BD,
 * o null si no tiene precio válido.
 */
function transformar(raw) {
  const precio_cop = limpiarPrecio(raw.precio_raw);
  const admin_cop = limpiarPrecio(raw.admin_raw);
  const texto = raw.texto_completo || "";
  const titulo = raw.titulo_raw || "";

  if (!precioValido(precio_cop)) return null;

  return {
    barrio_id: raw.barrio_id,
    tipo_inmueble: detectarTipo(titulo),
    precio_arriendo_cop: precio_cop,
    admin_cop: admin_cop ?? null,
    area_m2: extraerAreaM2(texto),
    habitaciones: extraerHabitaciones(texto),
    banos: extraerBanos(texto),
    parqueaderos: extraerParqueaderos(texto),
    titulo,
    descripcion: (raw.descripcion_raw || "").substring(0, 300),
    badge: raw.badge_raw || null,
    link: normalizarLink(raw.link_raw),
    pagina_scraping: raw.pagina,
    url_fuente: raw.url_fuente,
    fecha_scraping: raw.fecha_scraping,
    hora_scraping: raw.hora_scraping,
  };
}

// ─────────────────────────────────────────────
//  FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────

/**
 * Transforma un array de registros crudos en propiedades limpias.
 * @param {Array} registrosCrudos — datos crudos del scraper (con barrio_id)
 * @returns {{ propiedades: Array, descartados: number }}
 */
function ejecutarETL(registrosCrudos) {
  console.log("=".repeat(50));
  console.log("  ETL — Limpieza y transformación");
  console.log("=".repeat(50));
  console.log(`  ${registrosCrudos.length} registros crudos recibidos`);
  console.log("  Limpiando y estructurando...");

  const propiedades = [];
  let descartados = 0;

  for (const raw of registrosCrudos) {
    const resultado = transformar(raw);
    if (resultado) {
      propiedades.push(resultado);
    } else {
      descartados++;
    }
  }

  console.log(`  ${propiedades.length} propiedades válidas`);
  console.log(`  ${descartados} descartados (sin precio o fuera de rango)`);
  console.log("=".repeat(50));

  return { propiedades, descartados };
}

module.exports = { ejecutarETL };
