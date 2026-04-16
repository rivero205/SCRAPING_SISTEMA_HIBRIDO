/**
 * ============================================================
 *  API REST — Servidor de sincronización de barrios
 *  Proyecto: Mapa de Oportunidad Comercial — Cartagena
 * ============================================================
 *
 *  Uso:
 *    node src/server.js
 * ============================================================
 */

const express = require("express");
const logger = require("./config/logger");
const db = require("./config/database");
const barriosRoutes = require("./routes/barrios.routes");
const propiedadesRoutes = require("./routes/propiedades.routes");
const { rutaNoEncontrada, manejadorGlobal } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware global ───────────────────────────────────────
app.use(express.json({ limit: "10mb" }));

// Log de cada petición entrante
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

// ─── Rutas ───────────────────────────────────────────────────
app.use("/api", barriosRoutes);
app.use("/api", propiedadesRoutes);

// ─── Manejo de errores ───────────────────────────────────────
app.use(rutaNoEncontrada);
app.use(manejadorGlobal);

// ─── Inicialización ──────────────────────────────────────────
db.inicializar();

const servidor = app.listen(PORT, () => {
  logger.info("═══════════════════════════════════════════════════════════");
  logger.info("  API REST — Sincronización de Barrios (SQLite)");
  logger.info("  Proyecto: Mapa de Oportunidad Comercial — Cartagena");
  logger.info("═══════════════════════════════════════════════════════════");
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
  logger.info("Endpoints disponibles:");
  logger.info(`  POST  http://localhost:${PORT}/api/sincronizar-barrios`);
  logger.info(`  GET   http://localhost:${PORT}/api/barrios`);
  logger.info(`  GET   http://localhost:${PORT}/api/propiedades`);
  logger.info(`  GET   http://localhost:${PORT}/api/propiedades/:barrioId`);
  logger.info(`  GET   http://localhost:${PORT}/api/propiedades/stats`);
});

// ─── Cierre limpio ───────────────────────────────────────────
function cerrarServidor() {
  logger.info("Cerrando servidor...");
  db.cerrar();
  servidor.close(() => {
    logger.info("Servidor detenido.");
    process.exit(0);
  });
}

process.on("SIGINT", cerrarServidor);
process.on("SIGTERM", cerrarServidor);
