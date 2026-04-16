/**
 * Rutas para el recurso Propiedades (datos del scraping).
 *
 *  GET /api/propiedades              → Todas las propiedades con info del barrio
 *  GET /api/propiedades/:barrioId    → Propiedades de un barrio específico
 *  GET /api/propiedades/stats        → Estadísticas generales
 */

const { Router } = require("express");
const db = require("../config/database");
const logger = require("../config/logger");

const router = Router();

// ─── GET /api/propiedades/stats ──────────────────────────────
router.get("/propiedades/stats", (req, res, next) => {
  try {
    const totalPropiedades = db.contarPropiedades();
    const totalBarrios = db.contarTotal();

    logger.info("GET /api/propiedades/stats");

    res.json({
      exito: true,
      total_propiedades: totalPropiedades,
      total_barrios: totalBarrios,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/propiedades ────────────────────────────────────
router.get("/propiedades", (req, res, next) => {
  try {
    const limite = parseInt(req.query.limite) || undefined;
    const offset = parseInt(req.query.offset) || undefined;

    const propiedades = db.obtenerPropiedades({ limite, offset });

    logger.info(`GET /api/propiedades — ${propiedades.length} registros`);

    res.json({
      exito: true,
      total: propiedades.length,
      propiedades,
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/propiedades/:barrioId ──────────────────────────
router.get("/propiedades/:barrioId", (req, res, next) => {
  try {
    const barrio_id = parseInt(req.params.barrioId);

    if (isNaN(barrio_id)) {
      const error = new Error("El parámetro barrioId debe ser un número.");
      error.statusCode = 400;
      throw error;
    }

    const propiedades = db.obtenerPropiedades({ barrio_id });

    logger.info(
      `GET /api/propiedades/${barrio_id} — ${propiedades.length} registros`
    );

    res.json({
      exito: true,
      barrio_id,
      total: propiedades.length,
      propiedades,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
