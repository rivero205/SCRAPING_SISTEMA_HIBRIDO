/**
 * Rutas para el recurso Barrios.
 *
 *  POST /api/sincronizar-barrios  → Recibe array de barrios y los guarda en SQLite
 *  GET  /api/barrios              → Devuelve todos los barrios almacenados
 */

const { Router } = require("express");
const db = require("../config/database");
const logger = require("../config/logger");

const router = Router();

// ─── POST /api/sincronizar-barrios ───────────────────────────
router.post("/sincronizar-barrios", (req, res, next) => {
  try {
    const { barrios } = req.body;

    // Validación del payload
    if (!barrios || !Array.isArray(barrios)) {
      const error = new Error('El body debe contener una propiedad "barrios" como array.');
      error.statusCode = 400;
      throw error;
    }

    if (barrios.length === 0) {
      const error = new Error("El array de barrios está vacío.");
      error.statusCode = 400;
      throw error;
    }

    // Insertar en la BD dentro de una transacción
    const resultado = db.insertarBarrios(barrios);
    const total = db.contarTotal();

    logger.info(`${resultado.insertados} barrios guardados en SQLite`);
    if (resultado.errores.length > 0) {
      logger.warn(`${resultado.errores.length} registros con errores`, {
        errores: resultado.errores,
      });
    }
    logger.info(`Total de registros en BD: ${total}`);

    return res.status(201).json({
      exito: true,
      mensaje: `${resultado.insertados} barrios guardados en la base de datos.`,
      total_insertados: resultado.insertados,
      total_en_bd: total,
      total_errores: resultado.errores.length,
      errores: resultado.errores.length > 0 ? resultado.errores : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/barrios ────────────────────────────────────────
router.get("/barrios", (req, res, next) => {
  try {
    const barrios = db.obtenerTodos();

    logger.info(`Consulta GET /api/barrios — ${barrios.length} registros`);

    res.json({
      exito: true,
      total: barrios.length,
      barrios,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
