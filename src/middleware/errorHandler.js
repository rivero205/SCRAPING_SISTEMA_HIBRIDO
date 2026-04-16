/**
 * Middleware centralizado para manejo de errores.
 */

const logger = require("../config/logger");

/**
 * Middleware para rutas no encontradas (404).
 */
function rutaNoEncontrada(req, res, next) {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

/**
 * Middleware global de errores.
 * Captura cualquier error lanzado en los controladores/rutas.
 */
function manejadorGlobal(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const mensaje = err.message || "Error interno del servidor";

  logger.error(mensaje, {
    statusCode,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  res.status(statusCode).json({
    exito: false,
    mensaje,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = { rutaNoEncontrada, manejadorGlobal };
