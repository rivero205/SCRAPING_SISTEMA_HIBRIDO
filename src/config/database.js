/**
 * Conexión y configuración de la base de datos SQLite.
 * Gestiona las tablas: barrios, propiedades.
 */

const Database = require("better-sqlite3");
const path = require("path");
const logger = require("./logger");

const DB_PATH = path.join(__dirname, "..", "..", "data", "barrios.db");

let db;

// ─── Utilidades ──────────────────────────────────────────────

/**
 * Convierte un nombre de barrio a slug para URLs.
 * "El Laguito" → "el-laguito", "El Pozón" → "el-pozon"
 */
function generarSlug(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Inicialización ──────────────────────────────────────────

/**
 * Inicializa la conexión a SQLite, crea las tablas si no existen
 * y ejecuta migraciones pendientes.
 */
function inicializar() {
  try {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Tabla de barrios
    db.exec(`
      CREATE TABLE IF NOT EXISTS barrios (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre            TEXT NOT NULL UNIQUE,
        slug              TEXT,
        estrato           INTEGER,
        latitud           REAL,
        longitud          REAL,
        area_km2          REAL,
        estado_pavimento  TEXT,
        iluminacion_led   INTEGER,
        fecha_insercion   TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // Migración: agregar columna slug si no existe (BD pre-existentes)
    const columnas = db.pragma("table_info(barrios)");
    const tieneSlug = columnas.some((col) => col.name === "slug");
    if (!tieneSlug) {
      db.exec("ALTER TABLE barrios ADD COLUMN slug TEXT");
    }

    // Generar slugs para barrios que aún no lo tengan
    const sinSlug = db
      .prepare("SELECT id, nombre FROM barrios WHERE slug IS NULL")
      .all();
    if (sinSlug.length > 0) {
      const actualizarSlug = db.prepare(
        "UPDATE barrios SET slug = ? WHERE id = ?"
      );
      const tx = db.transaction((lista) => {
        for (const b of lista) actualizarSlug.run(generarSlug(b.nombre), b.id);
      });
      tx(sinSlug);
      logger.info(`Slugs generados para ${sinSlug.length} barrios`);
    }

    // Tabla de propiedades (datos del scraping, FK → barrios)
    db.exec(`
      CREATE TABLE IF NOT EXISTS propiedades (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        barrio_id           INTEGER NOT NULL,
        tipo_inmueble       TEXT,
        precio_arriendo_cop INTEGER,
        admin_cop           INTEGER,
        area_m2             REAL,
        habitaciones        INTEGER,
        banos               INTEGER,
        parqueaderos        INTEGER,
        titulo              TEXT,
        descripcion         TEXT,
        badge               TEXT,
        link                TEXT,
        pagina_scraping     INTEGER,
        url_fuente          TEXT,
        fecha_scraping      TEXT,
        hora_scraping       TEXT,
        fecha_insercion     TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (barrio_id) REFERENCES barrios(id)
      )
    `);

    logger.info(`Base de datos SQLite conectada: ${DB_PATH}`);
  } catch (error) {
    logger.error("No se pudo conectar a la base de datos", {
      error: error.message,
    });
    throw error;
  }
}

// ─── Operaciones de Barrios ──────────────────────────────────

/**
 * Inserta un array de barrios dentro de una transacción.
 * Genera automáticamente el slug a partir del nombre.
 * Retorna { insertados, errores }.
 */
function insertarBarrios(barrios) {
  const insertar = db.prepare(`
    INSERT OR REPLACE INTO barrios
      (nombre, slug, estrato, latitud, longitud, area_km2, estado_pavimento, iluminacion_led)
    VALUES
      (@nombre, @slug, @estrato, @latitud, @longitud, @area_km2, @estado_pavimento, @iluminacion_led)
  `);

  const transaccion = db.transaction((lista) => {
    let insertados = 0;
    const errores = [];

    for (let i = 0; i < lista.length; i++) {
      const barrio = lista[i];
      try {
        if (!barrio.nombre) {
          errores.push({ index: i, error: "Falta el campo 'nombre'" });
          continue;
        }

        insertar.run({
          nombre: barrio.nombre,
          slug: generarSlug(barrio.nombre),
          estrato: barrio.estrato ?? null,
          latitud: barrio.coordenadas?.lat ?? null,
          longitud: barrio.coordenadas?.lon ?? null,
          area_km2: barrio.area_km2 ?? null,
          estado_pavimento: barrio.estado_pavimento ?? "DESCONOCIDO",
          iluminacion_led: barrio.iluminacion_led ? 1 : 0,
        });
        insertados++;
      } catch (err) {
        errores.push({ index: i, nombre: barrio.nombre, error: err.message });
      }
    }

    return { insertados, errores };
  });

  return transaccion(barrios);
}

/**
 * Devuelve todos los barrios ordenados por nombre.
 */
function obtenerTodos() {
  return db.prepare("SELECT * FROM barrios ORDER BY nombre").all();
}

/**
 * Devuelve el total de registros en la tabla barrios.
 */
function contarTotal() {
  return db.prepare("SELECT COUNT(*) as total FROM barrios").get().total;
}

/**
 * Devuelve barrios con id, nombre y slug para el scraping.
 */
function obtenerBarriosParaScraping() {
  return db
    .prepare("SELECT id, nombre, slug FROM barrios ORDER BY nombre")
    .all();
}

// ─── Operaciones de Propiedades ──────────────────────────────

/**
 * Elimina todas las propiedades (antes de un nuevo scraping).
 * Retorna la cantidad de registros eliminados.
 */
function limpiarPropiedades() {
  return db.prepare("DELETE FROM propiedades").run().changes;
}

/**
 * Inserta un array de propiedades limpias en una transacción.
 * Cada objeto debe contener barrio_id como FK.
 * Retorna { insertados, errores }.
 */
function insertarPropiedades(propiedades) {
  const insertar = db.prepare(`
    INSERT INTO propiedades
      (barrio_id, tipo_inmueble, precio_arriendo_cop, admin_cop,
       area_m2, habitaciones, banos, parqueaderos,
       titulo, descripcion, badge, link,
       pagina_scraping, url_fuente, fecha_scraping, hora_scraping)
    VALUES
      (@barrio_id, @tipo_inmueble, @precio_arriendo_cop, @admin_cop,
       @area_m2, @habitaciones, @banos, @parqueaderos,
       @titulo, @descripcion, @badge, @link,
       @pagina_scraping, @url_fuente, @fecha_scraping, @hora_scraping)
  `);

  const transaccion = db.transaction((lista) => {
    let insertados = 0;
    const errores = [];

    for (let i = 0; i < lista.length; i++) {
      try {
        insertar.run(lista[i]);
        insertados++;
      } catch (err) {
        errores.push({ index: i, error: err.message });
      }
    }

    return { insertados, errores };
  });

  return transaccion(propiedades);
}

/**
 * Consulta propiedades con JOIN a barrios.
 * Permite filtrar por barrio_id y paginar con limite/offset.
 */
function obtenerPropiedades({ barrio_id, limite, offset } = {}) {
  let query = `
    SELECT p.*, b.nombre AS barrio_nombre, b.estrato AS barrio_estrato
    FROM propiedades p
    JOIN barrios b ON p.barrio_id = b.id
  `;
  const params = [];

  if (barrio_id) {
    query += " WHERE p.barrio_id = ?";
    params.push(barrio_id);
  }

  query += " ORDER BY p.id DESC";

  if (limite) {
    query += " LIMIT ?";
    params.push(limite);
    if (offset) {
      query += " OFFSET ?";
      params.push(offset);
    }
  }

  return db.prepare(query).all(...params);
}

/**
 * Devuelve el total de propiedades en la BD.
 */
function contarPropiedades() {
  return db.prepare("SELECT COUNT(*) as total FROM propiedades").get().total;
}

// ─── Cierre ──────────────────────────────────────────────────

/**
 * Cierra la conexión a la base de datos.
 */
function cerrar() {
  if (db) {
    db.close();
    logger.info("Base de datos cerrada.");
  }
}

module.exports = {
  generarSlug,
  inicializar,
  insertarBarrios,
  obtenerTodos,
  contarTotal,
  obtenerBarriosParaScraping,
  limpiarPropiedades,
  insertarPropiedades,
  obtenerPropiedades,
  contarPropiedades,
  cerrar,
};
