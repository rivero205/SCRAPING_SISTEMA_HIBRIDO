SCRAPING_SISTEMA_HIBRIDO — README para exposición en clase

- Objetivo: explicar un sistema híbrido de scraping + ETL para obtener, normalizar y servir datos de propiedades.
- Audiencia: estudiantes de ingeniería de software y datos; enfoque en arquitectura, flujo y demostración práctica.
- Resumen breve: módulo de scraping (obtiene HTML/API), ETL (transforma y almacena), API/servidor (expone datos), scripts de sincronización y logs.

- Estructura principal (resumen):
  - scripts/: herramientas operativas (scraper, etl, pipeline, sincronizar).
  - src/: servidor y lógica de exposición (API REST).
  - config/: configuración (database.js, logger.js).
  - routes/ y middleware/: rutas HTTP y manejo de errores.
  - data/: artefactos resultantes (ej.: barrios.json).

- Requisitos mínimos:
  - Node.js 16+ y npm.
  - Conexión a la base de datos según config/database.js (si aplica).
  - Permisos de red para scraping (user-agent, respetar robots.txt en demo si se requiere).

- Instalación rápida:
  - `npm install` para dependencias.
  - Revisar variables de entorno o config/database.js para credenciales.

- Scripts y uso (línea de comandos):
  - `node scripts/scraper.js` — ejecuta el scraper que extrae páginas/JSON.
  - `node scripts/etl.js` — aplica transformaciones y guarda en data/ o DB.
  - `node scripts/pipeline.js` — orquesta scraper + ETL (modo batch).
  - `node scripts/sincronizar.js` — sincroniza cambios incrementalmente.
  - `node src/server.js` — inicia la API HTTP para consultar resultados.

- Flujo de datos (paso a paso):
  - 1) Scraper: recupera HTML/JSON, normaliza campos brutos.
  - 2) ETL: parsea, limpia, deduplica, normaliza geografía y precios.
  - 3) Persistencia: guarda en JSON local (data/) o en DB configurada.
  - 4) API: expone endpoints para consulta y filtrado.

- Endpoints clave (ejemplos):
  - GET /barrios — lista barrios (filtros: ciudad, orden).
  - GET /propiedades — lista propiedades (filtros: barrio, precio, tipo).
  - GET /propiedades/:id — detalle de propiedad.
  - (Ver routes/ para rutas exactas y parámetros.)

- Formato de datos (esquema resumido):
  - Barrio: { id, nombre, provincia, lat, lon, fuente }.
  - Propiedad: { id, titulo, descripcion, precio, moneda, direccion, barrioId, metros, ambientes, fuente, url }.

- Consideraciones técnicas importantes:
  - Robustez frente a cambios HTML: usar selectores tolerantes y fallbacks.
  - Control de velocidad: respetar throttle y delays para evitar bloqueos.
  - Manejo de errores: reintentos exponenciales y logs detallados (config/logger.js).
  - Datos personales: anonimizar si aparece información sensible.

- Cómo preparar la demo en clase (pasos rápidos):
  - 1) Clonar repo y `npm install`.
  - 2) Revisar y ajustar config/database.js o configurar modo local (JSON).
  - 3) Ejecutar `node scripts/pipeline.js` para pipeline completo.
  - 4) Iniciar API con `node src/server.js` y abrir Postman o curl.
  - 5) Mostrar GET /barrios y GET /propiedades con ejemplos de filtros.
  - 6) Abrir data/barrios.json para mostrar resultado persistido.

- Puntos clave para explicar en clase (guión de exposición):
  - Motivación: por qué combinar scraping y ETL (calidad + automatización).
  - Arquitectura: desacoplar extracción, transformación y exposición.
  - Ejemplos de limpieza: normalización de monedas, parseo de precios, extracción de coordenadas.
  - Escalabilidad: cuándo pasar de JSON a DB, y opciones (Postgres, Mongo).
  - Ética y legalidad: respetar Términos, privacidad y límites de scraping.

- Problemas comunes y soluciones rápidas:
  - Selectores rotos → actualizar reglas o usar heurísticas de texto.
  - IP bloqueada → implementar rotación de proxys y backoff.
  - Datos duplicados → deduplicar por url + hash de contenido.
  - Inconsistencias en precios → estandarizar moneda y rango válido.

- Extensiones posibles para proyectos:
  - Añadir pipeline en tiempo real (cola + workers).
  - Dashboard con visualización geoespacial.
  - Modelos ML para detectar outliers o estimar precios.

- Recursos y referencias rápidas:
  - Código fuente: revisar scripts/ y src/ para lógica principal.
  - Logs: consultar logs/ para auditoría y debugging.
  - Datos de ejemplo: data/barrios.json.

- Checklist antes de exponer:
  - Repo clonado y dependencias instaladas.
  - Scripts ejecutados localmente y API en marcha.
  - Casos de prueba cortos preparados (curl/ejemplos).
  - Slides con diagramas: flujo, componentes y ejemplos.

- Contacto y notas finales:
  - Mantener la demo simple: mostrar flujo completo con 2-3 comandos.
  - Invitar a preguntas técnicas: arquitectura, manejo de errores, ética.
  - ¿Deseas que genere diapositivas o ejemplos de curl para la demo? (sí/no)
# 🏘️ Scraping Inmobiliario + API REST — Cartagena de Indias

Proyecto que recopila datos del mercado de arriendo en Cartagena de Indias mediante web scraping a Fincaraiz, los transforma con un proceso ETL y los almacena en una base de datos SQLite relacional. Los datos se exponen a través de una API REST para su consulta y posterior análisis.

## 🎯 ¿Qué hace este proyecto?

1. **Sincroniza** 200 barrios de Cartagena (infraestructura, estrato, coordenadas) desde un JSON a SQLite.
2. **Scrapea** listados de arriendo de [Fincaraiz](https://www.fincaraiz.com.co) para cada barrio registrado en la BD.
3. **Transforma** (ETL) los datos crudos: limpia precios, extrae área, habitaciones, baños, tipo de inmueble, etc.
4. **Almacena** las propiedades en la tabla `propiedades`, relacionadas por `barrio_id` con la tabla `barrios`.
5. **Expone** toda la información mediante una API REST con endpoints de consulta.

## 📂 Estructura del Proyecto

```
actividad_3/
├── src/
│   ├── config/
│   │   ├── database.js            # Conexión SQLite, tablas barrios y propiedades
│   │   └── logger.js              # Logger con Winston
│   ├── middleware/
│   │   └── errorHandler.js        # Manejo centralizado de errores
│   ├── routes/
│   │   ├── barrios.routes.js      # POST y GET de barrios
│   │   └── propiedades.routes.js  # GET de propiedades (scraping)
│   └── server.js                  # Entry point del servidor
├── scripts/
│   ├── sincronizar.js             # Carga barrios.json → BD vía API
│   ├── scraper.js                 # Módulo de scraping (Fincaraiz)
│   ├── etl.js                     # Módulo ETL (limpieza y transformación)
│   └── pipeline.js                # Orquestador: BD → Scraping → ETL → BD
├── data/
│   ├── barrios.json               # JSON fuente con 200 barrios
│   └── barrios.db                 # Base de datos SQLite (generada)
├── logs/                          # Logs de la API (generados)
├── package.json
└── README.md
```

## 🛠️ Instalación

```bash
npm install
```

## 🚀 Uso

### 1. Levantar el servidor API

```bash
npm start
```

El servidor se inicia en `http://localhost:5000` y crea automáticamente la base de datos con las tablas `barrios` y `propiedades`.

### 2. Sincronizar barrios a la BD

En otra terminal:

```bash
npm run sync
```

Lee `barrios.json`, extrae los campos de infraestructura y los envía por POST al servidor, que los guarda en SQLite.

### 3. Ejecutar el pipeline de scraping

```bash
npm run scraping
```

Este comando:
- Consulta todos los barrios almacenados en la BD (con su `id` y `slug`)
- Scrapea listados de arriendo de Fincaraiz para cada barrio
- Limpia y transforma los datos (ETL)
- Inserta las propiedades en la tabla `propiedades` con la FK `barrio_id`

## 📌 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/sincronizar-barrios` | Recibe un array de barrios y los guarda en la BD |
| `GET`  | `/api/barrios` | Devuelve todos los barrios almacenados |
| `GET`  | `/api/propiedades` | Todas las propiedades con info del barrio (`?limite=50&offset=0`) |
| `GET`  | `/api/propiedades/:barrioId` | Propiedades filtradas por barrio |
| `GET`  | `/api/propiedades/stats` | Total de propiedades y barrios en BD |

## 📊 Modelo de datos

### Tabla `barrios`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | Identificador único |
| `nombre` | TEXT | Nombre del barrio |
| `slug` | TEXT | Slug para URLs (ej: `el-laguito`) |
| `estrato` | INTEGER | Estrato socioeconómico (1-6) |
| `latitud` / `longitud` | REAL | Coordenadas geográficas |
| `area_km2` | REAL | Área del barrio en km² |
| `estado_pavimento` | TEXT | BUENO / REGULAR / MALO |
| `iluminacion_led` | INTEGER | Si tiene iluminación LED |

### Tabla `propiedades`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | Identificador único |
| `barrio_id` | INTEGER FK | Relación con `barrios.id` |
| `tipo_inmueble` | TEXT | apartamento, casa, local, etc. |
| `precio_arriendo_cop` | INTEGER | Precio mensual en COP |
| `admin_cop` | INTEGER | Costo de administración |
| `area_m2` | REAL | Área en metros cuadrados |
| `habitaciones` | INTEGER | Número de habitaciones |
| `banos` | INTEGER | Número de baños |
| `parqueaderos` | INTEGER | Número de parqueaderos |
| `titulo` | TEXT | Título del listado |
| `link` | TEXT | URL del listado en Fincaraiz |
| `fecha_scraping` | TEXT | Fecha de extracción |

## 💡 Posibles análisis de BI

Los datos recopilados abren la puerta a múltiples análisis de inteligencia de negocios. Algunas ideas:

- **Mapa de precios de arriendo por barrio** — Visualizar el precio promedio por zona y estrato, identificando barrios económicos vs. premium.
- **Relación estrato vs. precio real** — ¿Los estratos altos siempre implican arriendos más caros? ¿Hay oportunidades en estratos medios?
- **Densidad de oferta por barrio** — ¿Qué barrios tienen más propiedades disponibles? ¿Hay sobreoferta o escasez en ciertas zonas?
- **Precio por metro cuadrado** — Comparativa de valor por m² entre barrios para detectar zonas subvaloradas.
- **Tipología de inmuebles por zona** — ¿Qué tipo de propiedad predomina en cada barrio? (apartamentos, casas, locales, etc.)
- **Evolución temporal** — Con scraping periódico, analizar tendencias de precios y disponibilidad a lo largo del tiempo.
- **Correlación infraestructura ↔ precio** — ¿Los barrios con mejor pavimento e iluminación LED tienen arriendos más altos?
- **Oportunidad comercial** — Cruzar precio, tipo de inmueble y ubicación para identificar zonas ideales para abrir negocios.

## 🧰 Tecnologías

- **Node.js** + **Express** — API REST
- **better-sqlite3** — Base de datos SQLite
- **axios** — Cliente HTTP y scraping
- **cheerio** — Parsing de HTML (web scraping)
- **winston** — Logging profesional

## 👥 Autores

Proyecto académico — Electiva de Profundización C2
