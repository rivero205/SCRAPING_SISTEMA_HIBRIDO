/**
 * ============================================================
 *  Script de sincronización: barrios.json → API REST (POST)
 * ============================================================
 *
 *  Lee el archivo barrios.json, extrae los campos relevantes
 *  de infraestructura urbana y los envía mediante HTTP POST
 *  al endpoint del servidor Express.
 *
 *  Uso:
 *    node scripts/sincronizar.js
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");

// ─── Configuración ────────────────────────────────────────────
const ARCHIVO_JSON = path.join(__dirname, "..", "data", "barrios.json");
const API_URL = process.env.API_URL || "http://localhost:5000/api/sincronizar-barrios";
// ──────────────────────────────────────────────────────────────

/**
 * Lee el archivo JSON y devuelve el objeto parseado.
 */
function leerArchivo(ruta) {
  try {
    const contenido = fs.readFileSync(ruta, "utf-8");
    return JSON.parse(contenido);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`[ERROR] No se encontró el archivo "${ruta}".`);
    } else if (error instanceof SyntaxError) {
      console.error(`[ERROR] El archivo no contiene un JSON válido.`);
    } else {
      console.error(`[ERROR] Error inesperado al leer el archivo:`, error.message);
    }
    process.exit(1);
  }
}

/**
 * Extrae de cada barrio únicamente los campos que necesita
 * la base de datos del proyecto, con validaciones defensivas.
 */
function transformarBarrios(barrios) {
  return barrios.map((barrio) => {
    const nombre = barrio.nombre ?? null;
    const estrato = barrio.estrato ?? null;
    const coordenadas = barrio.coordenadas ?? { lat: null, lon: null };
    const area_km2 = barrio.area_km2 ?? null;

    const avenidas = barrio.vias?.avenidas;
    const calles = barrio.vias?.calles;

    const estado_pavimento =
      Array.isArray(avenidas) && avenidas.length > 0
        ? avenidas[0].estado_pavimento ?? "DESCONOCIDO"
        : "DESCONOCIDO";

    const iluminacion_led =
      Array.isArray(calles) && calles.length > 0
        ? calles[0].iluminacion_led ?? false
        : false;

    return {
      nombre,
      estrato,
      coordenadas,
      area_km2,
      estado_pavimento,
      iluminacion_led,
    };
  });
}

/**
 * Envía el payload completo al endpoint POST en una sola petición.
 */
async function enviarDatos(payload) {
  try {
    console.log(`\n[INFO] Enviando ${payload.length} barrios a ${API_URL} …\n`);

    const respuesta = await axios.post(
      API_URL,
      { barrios: payload },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    console.log(`[OK] Respuesta del servidor (${respuesta.status}):`);
    console.log(JSON.stringify(respuesta.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error(
        `[ERROR] Error del servidor (${error.response.status}):`,
        JSON.stringify(error.response.data, null, 2)
      );
    } else if (error.request) {
      console.error(
        "[ERROR] No se recibió respuesta del servidor. ¿Está corriendo la API en",
        API_URL,
        "?"
      );
    } else {
      console.error("[ERROR] Error al preparar la petición:", error.message);
    }
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Sincronización de Barrios → Base de Datos");
  console.log("  Proyecto: Mapa de Oportunidad Comercial — Cartagena");
  console.log("═══════════════════════════════════════════════════════════");

  // 1. Leer JSON
  const datos = leerArchivo(ARCHIVO_JSON);

  if (!datos.barrios || !Array.isArray(datos.barrios)) {
    console.error('[ERROR] El JSON no tiene la propiedad "barrios" como array.');
    process.exit(1);
  }

  console.log(
    `[INFO] Archivo leído: ${datos.total_registros ?? datos.barrios.length} barrios encontrados.`
  );

  // 2. Transformar
  const payload = transformarBarrios(datos.barrios);

  // Vista previa (primeros 3)
  console.log("\n[INFO] Vista previa de los primeros 3 registros:");
  console.log(JSON.stringify(payload.slice(0, 3), null, 2));

  // 3. Enviar
  await enviarDatos(payload);

  console.log("\n[OK] Sincronización completada exitosamente.");
}

main();
