ELT Pipeline — SQLite → MongoDB Atlas                                                                                                                      
                                                                                                                                                             
  ¿Qué se agregó al proyecto?                                                                                                                                
                                                                                                                                                             
  Se añadió una nueva etapa al sistema existente: un pipeline ELT que toma los datos ya recolectados (barrios sincronizados y propiedades scrapeadas) y los
  carga en MongoDB Atlas como documentos planos con análisis de inteligencia de negocios.

  Archivos nuevos o modificados

  ┌──────────────────────┬───────────────────────────────────────────────────────────────────┐
  │       Archivo        │                              Cambio                               │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ scripts/etl_mongo.js │ Script nuevo — pipeline ELT completo                              │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ package.json         │ Se agregó el script etl:mongo y las dependencias mongodb y mysql2 │
  └──────────────────────┴───────────────────────────────────────────────────────────────────┘

  Cómo ejecutar

  # Paso 1 — levantar servidor y sincronizar barrios
  npm start          # terminal 1, dejar corriendo
  npm run sync       # terminal 2

  # Paso 2 — scrapear Fincaraiz (apagar servidor primero con Ctrl+C)
  npm run scraping

  # Paso 3 — cargar en MongoDB con análisis BI
  npm run etl:mongo

  Si ya tienes datos en SQLite de una corrida anterior, puedes ejecutar directamente el paso 3.

  Flujo del pipeline

  SQLite (barrios + propiedades)
           │
           │  EXTRACT
           ▼
    Estadísticas globales calculadas en memoria:
      · Precio promedio y mediana de toda Cartagena
      · Precio/m² promedio de la ciudad
      · Media de propiedades por barrio
      · Correlación infraestructura → precio
           │
           │  LOAD + TRANSFORM
           ▼
    MongoDB Atlas — base de datos: cartagena_bi
      ├── barrios_bi          (178 documentos)
      └── propiedades_bi      (5.933 documentos)

  Estructura de los documentos en MongoDB

  Los documentos son planos y sin relaciones. No existen referencias entre colecciones — los datos del barrio van embebidos directamente en cada propiedad.

  barrios_bi — cada documento responde la pregunta: ¿Hay sobreoferta o escasez en esta zona?

  {
    "nombre": "Cabrero",
    "estrato": 5,
    "latitud": 10.432,
    "longitud": -75.542,
    "area_km2": 0.4,
    "estado_pavimento": "BUENO",
    "iluminacion_led": true,
    "total_propiedades_scraped": 45,
    "avg_precio_cop": 2800000,
    "avg_precio_m2": 31500,
    "_fuente": "sqlite:barrios",
    "_fecha_carga": "2026-04-16T22:20:47.142Z",
    "conclusion": "Cabrero es un barrio de estrato 5 con 45 propiedades disponibles, por encima de la media de Cartagena (33 por barrio), lo que evidencia
  sobreoferta. Sorprendentemente, pese a la sobreoferta, el arriendo promedio de $2.800.000 COP supera en 18% la media de la ciudad, lo que sugiere que la
  demanda absorbe bien el inventario disponible."
  }

  propiedades_bi — cada documento responde la pregunta: ¿Es este inmueble económico o caro frente al mercado?

  {
    "tipo_inmueble": "apartamento",
    "precio_arriendo_cop": 934000,
    "area_m2": 50,
    "habitaciones": 2,
    "banos": 2,
    "precio_por_m2": 18680,
    "barrio_id": 107,
    "barrio_nombre": "Zaragocilla Sector El Triunfo",
    "barrio_estrato": 2,
    "_fuente": "sqlite:propiedades",
    "_fecha_carga": "2026-04-16T22:20:47.142Z",
    "conclusion": "Su precio de $934.000 COP está 82% por debajo del promedio de Zaragocilla Sector El Triunfo ($5.224.476 COP), lo que lo hace notablemente
  más accesible que la competencia cercana. A $18.680/m², se ubica en el percentil 10 más económico de toda Cartagena, siendo una opción subvalorada frente
  al mercado general. En conjunto, representa una oportunidad de arriendo clara: barato frente a su barrio y frente a la ciudad."
  }

  Cómo se genera el campo conclusion

  No es texto fijo. Se calcula comparando cada documento contra estadísticas reales del dataset completo:

  Para barrios:
  - Cuenta cuántas propiedades tiene ese barrio vs la media de la ciudad
  - Determina si hay sobreoferta (>2x la media), escasez (<0.5x) o equilibrio
  - Cruza esa densidad con el comportamiento del precio promedio del barrio vs la ciudad
  - Redacta un párrafo que explica la relación oferta-precio de forma interpretable

  Para propiedades:
  - Compara el precio de la propiedad vs el promedio del barrio al que pertenece
  - Calcula el precio/m² y lo ubica en un percentil dentro del dataset completo de Cartagena
  - Emite un veredicto: oportunidad clara, sobrevalorado, o precio de mercado

  Dependencias agregadas

  npm install mongodb mysql2

  ┌─────────┬──────────────────────────────────────────────────────────────────┐
  │ Paquete │                               Uso                                │
  ├─────────┼──────────────────────────────────────────────────────────────────┤
  │ mongodb │ Driver oficial de MongoDB para Node.js                           │
  ├─────────┼──────────────────────────────────────────────────────────────────┤
  │ mysql2  │ Instalado como dependencia del proyecto, no usado en este script │
  └─────────┴──────────────────────────────────────────────────────────────────┘