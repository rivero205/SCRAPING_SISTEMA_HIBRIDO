SCRAPING: Guía técnica detallada (SCRAPING_SISTEMA_HIBRIDO)

Objetivo
- Describir a fondo cómo funciona el scraping en este proyecto, decisiones de diseño, control de calidad y extensibilidad.

Resumen arquitectónico
- Componente principal: `scripts/scraper.js` — responsable de recuperar páginas o endpoints fuente.
- Complementos: `scripts/etl.js` (transformación y limpieza), `scripts/pipeline.js` (orquestador), `scripts/sincronizar.js` (sincronización incremental).
- Salida: archivos JSON en `data/` y/o persistencia en la base definida en `config/database.js`.

Flujo operativo (alto nivel)
- 1) Inicialización: cargar configuración (timeouts, user-agent, proxies) desde `config/` o variables de entorno.
- 2) Programación/planificación: `pipeline.js` decide qué fuentes consultar y con qué frecuencia.
- 3) Extracción: `scraper.js` realiza peticiones HTTP, obtiene HTML/JSON.
- 4) Parsing: se extraen campos relevantes (título, precio, dirección, características, coordenadas).
- 5) Normalización: pasar valores heterogéneos a esquemas comunes (moneda, unidades, formatos de fecha).
- 6) Deduplicación y enriquecimiento: eliminar duplicados por `url`/hash y añadir datos derivados (ej.: barrio por geo-coords).
- 7) Persistencia: escribir a `data/` o guardar en DB.

Estructura y responsabilidades de `scraper.js`
- Configuración: definir `headers` (User-Agent), `rateLimit`, `retryPolicy`, `timeout`.
- Entrada: lista de URLs o endpoints (hardcoded, archivo, o generada por `pipeline.js`).
- Cliente HTTP: usar `axios` o `node-fetch` con adaptadores para proxies y timeouts.
- Parsers: funciones modulares por fuente — cada fuente define selectores/paths y transformaciones.
- Resultado: objeto normalizado (ver `docs/ESQUEMA.md` o sección "Formato de datos").

Estrategias de parsing
- HTML: preferir selectores CSS robustos; evitar rutas absolutas que rompen fácilmente.
- JSON: consumir directamente cuando la fuente expone API.
- Fallbacks: si un selector falla, intentar heurísticas de texto (buscar etiquetas por contexto, regex para precios).
- Parsers independientes por fuente para facilitar mantenimiento y tests.

Normalización y ETL (interacción con `etl.js`)
- Preprocesado: limpieza básica de strings, eliminación de espacios y caracteres no imprimibles.
- Precios: extraer número y moneda, convertir a una moneda canónica o almacenar `precio` + `moneda`.
- Medidas: normalizar metros cuadrados y otros atributos numéricos.
- Geocodificación: si faltan coords, intentar extraer de dirección o enriquecer vía servicio externo.

Control de calidad y deduplicación
- Detección por `url` única y por `hash` del contenido (body normalizado).
- Regla de preferencia: fuente priorizada o entrada más reciente según configuración.
- Validaciones: campos obligatorios (precio o dirección) y rangos plausibles (precios > 0).

Robustez y resiliencia
- Reintentos: política exponencial para errores de red y códigos 5xx.
- Timeouts claros para evitar cuelgues.
- Circuit breaker lógico: pausar scraping de una fuente tras N fallos consecutivos.

Rate limiting y cortesía
- Implementar delay entre peticiones a la misma host (throttling) y máximo concurrente.
- Respetar `robots.txt` en demostración pública; para pruebas locales, documentar excepciones.

Gestión de IP y anti-bloqueo
- Estrategias: rotación de proxies, cambio de User-Agent, uso de backoff ante bloqueos.
- Consideraciones legales: respetar TOS; registrar acciones en `logs/` para auditoría.

Logs, métricas y observabilidad
- Logs detallados por fuente: request, response status, errores de parsing, tiempo total.
- Métricas sugeridas: requests por minuto, errores por fuente, tasa de éxito, latencia media.

Pruebas y desarrollo
- Parsers unit-testables: crear muestras HTML/JSON y tests que validen extracción esperada.
- Modo sandbox: ejecutar scraper contra muestras locales antes de producción.

Configuración y despliegue
- Variables: timeouts, retries, listados de URLs, proxies — preferir variables de entorno.
- Entornos: modo `dev` (fácil, sin proxies), `prod` (rotación de IPs, persistencia a DB).

Seguridad y privacidad
- Evitar almacenar datos personales sensibles; anonimizar o truncar si aparecen.
- Mantener credenciales fuera del repo; usar `config/database.js` apuntando a variables seguras.

Extensibilidad y buenas prácticas
- Diseñar parsers como módulos plug-in para añadir nuevas fuentes sin tocar núcleo.
- Mantener mapeos de campos claros y documentados.
- Migrar a arquitectura con cola (RabbitMQ/Kafka) y workers si aumenta el volumen.

Archivos clave a revisar
- `scripts/scraper.js`, `scripts/etl.js`, `scripts/pipeline.js`, `config/database.js`, `config/logger.js`, `data/`.

Comandos útiles
```bash
# Ejecutar scraper puntual
node scripts/scraper.js

# Pipeline completo (scraper + ETL)
node scripts/pipeline.js

# Iniciar API para validar datos
node src/server.js
```

Notas finales
- Mantener parsers simples, testeadles y con buen logging; priorizar datos limpios sobre cantidad.
