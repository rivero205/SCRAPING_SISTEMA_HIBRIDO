/**
 * Configuración del logger con Winston.
 * Genera logs en consola y en archivos rotativos.
 */

const { createLogger, format, transports } = require("winston");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "..", "logs");

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { servicio: "api-barrios" },
  transports: [
    // Archivo de errores
    new transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
    }),
    // Archivo general
    new transports.File({
      filename: path.join(LOG_DIR, "app.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

// En desarrollo, mostrar también en consola con formato legible
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length > 1
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[${timestamp}] ${level}: ${message}${extra}`;
        })
      ),
    })
  );
}

module.exports = logger;
