# Power BI — Entrega adaptada a SCRAPING_SISTEMA_HIBRIDO (Cartagena)

Esta guía adapta lo que pidió el profesor (inventario + modelo relacional + DAX + dashboard) a **nuestro proyecto**:

- **Fuente real de datos**: SQLite `data/barrios.db`
- **Tablas principales**:
  - `barrios` (dimensión: zona + infraestructura)
  - `propiedades` (hechos: oferta de arriendos scrapeados)

La idea es presentar esto como un **sistema híbrido**: Scraping → ETL → BD relacional → Power BI.

---

## 1) Responsable de Integración y Modelado (Data Architect)

### 1.1 Carga de datos (equivalente a “importar g_inventario.sql”)

En nuestro caso no hay `g_inventario.sql`: el dataset vive en SQLite.

**Opción A (recomendada): exportar a CSV y cargar a Power BI**

1) Genera/actualiza la BD (si aún no existe):
- `npm install`
- `npm start`
- `npm run sync`
- `npm run scraping`

2) Exporta a CSV para Power BI:
- `npm run export:powerbi`

Se crean estos archivos en `data/powerbi/`:
- `dim_barrios.csv`
- `fact_propiedades.csv`
- `fact_propiedades_enriquecida.csv` (por si quieren un modelo “flat” para prototipar)
- `dim_fecha_scraping.csv`

3) En Power BI Desktop:
- **Obtener datos → Texto/CSV** → importa `dim_barrios.csv`
- **Obtener datos → Texto/CSV** → importa `fact_propiedades.csv`

**Opción B: conectar Power BI directo a SQLite**

Si tu Power BI tiene conector SQLite (o usas ODBC), puedes conectar directo a `data/barrios.db` e importar `barrios` y `propiedades`.

### 1.2 Modelo relacional (equivalente a “replicar modelo del PPT”)

Como nuestro dominio no es inventario sino **mercado de arriendo**, el “modelo equivalente” (limpio y defendible en clase) es una **estrella**:

- **DimBarrio** = `dim_barrios`
- **FactPropiedad** = `fact_propiedades`
- **DimFecha** = tabla calendario (recomendada) a partir de `fecha_scraping`
- (Opcional) **DimTipoInmueble** desde `tipo_inmueble` (si el profe exige más dimensiones)

**Relación obligatoria** (en la vista Modelo de Power BI):
- `FactPropiedad[barrio_id]` (muchos) → `DimBarrio[id]` (uno)

**Relación recomendada para tiempo**:
- `FactPropiedad[fecha_scraping]` (muchos) → `DimFecha[Date]` (uno)

**Cardinalidades**:
- `DimBarrio (1) ──── (N) FactPropiedad`
- `DimFecha (1) ──── (N) FactPropiedad`

### 1.3 Continuidad del proyecto (integrar scraping + ETL)

Lo que debes “defender” en la exposición:

- El scraping llena `propiedades` y referencia `barrios` por `barrio_id`.
- El ETL ya normaliza campos clave (precio, área, habitaciones, etc.).
- En Power Query se hacen ajustes “BI friendly” (tipos, fechas, columnas derivadas) sin romper la estructura.

**Power Query (mínimos recomendados)**

En `fact_propiedades`:
- Tipos:
  - `precio_arriendo_cop`, `admin_cop`, `costo_total_cop` → Número entero
  - `area_m2` → Número decimal
  - `fecha_scraping` → Fecha
- Columna derivada:
  - `Precio_m2` = `precio_arriendo_cop / area_m2` (manejar nulos o área 0)
- Limpieza:
  - `tipo_inmueble`: normalizar valores (ej. minúsculas, agrupar “apto/apartamento”)
  - `link`: deduplicación si hay listados repetidos

En `dim_barrios`:
- `iluminacion_led`: convertir a Sí/No (boolean)
- `estado_pavimento`: estandarizar (BUENO/REGULAR/MALO/DESCONOCIDO)

---

## 2) Responsable de Lógica y Análisis (DAX Specialist)

### 2.1 Medidas (equivalentes a stock, valorización, promedios)

Asumiendo que tus tablas en el modelo se llaman:
- `DimBarrio`
- `FactPropiedad`

Medidas base:

- **Total Ofertas**
  - `Total Ofertas = COUNTROWS(FactPropiedad)`

- **Barrios con oferta**
  - `Barrios con oferta = DISTINCTCOUNT(FactPropiedad[barrio_id])`

- **Precio Promedio (COP)**
  - `Precio Promedio = AVERAGE(FactPropiedad[precio_arriendo_cop])`

- **Costo Total Promedio (arriendo + admin)**
  - `Costo Total Promedio = AVERAGE(FactPropiedad[costo_total_cop])`

- **Mediana de Precio (COP)**
  - `Mediana Precio = MEDIANX(FactPropiedad, FactPropiedad[precio_arriendo_cop])`

- **Precio promedio por m²** (si creaste la columna `Precio_m2`)
  - `Precio m2 Promedio = AVERAGE(FactPropiedad[Precio_m2])`

- **Top barrio (oferta)**
  - `Max Ofertas Barrio = MAXX(VALUES(DimBarrio[nombre]), [Total Ofertas])`

### 2.2 Columnas calculadas (alertas tipo “stock bajo”)

Esto es lo más parecido a “inventario” en nuestro dominio:

- **Etiqueta de oferta (barrio)**
  - idea: comparar ofertas del barrio vs promedio ciudad

Puedes hacerlo como **medida** (recomendado) o como **columna** en una tabla resumen por barrio.

Ejemplo (medida) “Bandera Oferta” usando umbrales simples:
- `Oferta vs Promedio = DIVIDE([Total Ofertas], AVERAGEX(VALUES(DimBarrio[id]), [Total Ofertas]))`

Luego una medida tipo texto:
- `Estado Oferta = 
  VAR r = [Oferta vs Promedio]
  RETURN
    SWITCH(TRUE(),
      r >= 2, "Sobreoferta",
      r <= 0.5, "Escasez",
      "Equilibrio"
    )`

### 2.3 Validación de datos

Checklist mínimo:
- Validar conteos:
  - `COUNTROWS(FactPropiedad)` coincide con el total exportado.
- Validar relación:
  - `DimBarrio[id]` único (sin duplicados)
  - no hay `FactPropiedad[barrio_id]` “huérfanos” (sin barrio)
- Validar filtros:
  - al filtrar por `estrato` o `tipo_inmueble`, los KPIs cambian consistentemente

---

## 3) Responsable de Visualización y UX (Dashboard Designer)

### 3.1 Diseño de reportes (lo mínimo para una entrega sólida)

**Página 1 — Panorama Cartagena**
- KPIs (tarjetas):
  - Total Ofertas
  - Precio Promedio
  - Mediana Precio
  - Precio m2 Promedio
- Gráfico barras: Top 10 barrios por # ofertas
- Gráfico barras/columnas: Precio promedio por estrato

**Página 2 — Mapa + barrio**
- Mapa (latitud/longitud desde `DimBarrio`):
  - Tamaño burbuja: Total Ofertas
  - Color: Precio Promedio o Costo Total Promedio
- Tabla de detalle: barrio, estrato, # ofertas, precio promedio, precio m²

### 3.2 Interactividad (slicers)

Slicers recomendados:
- `DimBarrio[estrato]`
- `FactPropiedad[tipo_inmueble]`
- `DimFecha[Date]` (si creaste calendario)
- `DimBarrio[estado_pavimento]`
- `DimBarrio[iluminacion_led]`

### 3.3 Interfaz y estética (reglas simples)

- Mantener 1 paleta y 1 tipografía (la de Power BI por defecto está bien).
- Alinear títulos, usar unidades en COP y m².
- Evitar saturación: 6–8 visuales máximo por página.

---

## “Traducción” del enunciado del profe a nuestro proyecto

- **Inventario / stock** → **Oferta de propiedades** (# listados por barrio / tipo)
- **Valorización inventario** → **Valorización de arriendos** (promedio, mediana, precio/m²)
- **Empleado / rendimiento** → **Rendimiento por barrio/estrato** (oferta vs precio, oportunidades)
- **Modelo relacional del PPT** → **Modelo estrella con DimBarrio + FactPropiedad + DimFecha**

Si me compartes una foto (o texto) de la diapositiva exacta con los “requerimientos DAX” y el “modelo del PPT”, te lo ajusto 1:1 (nombres de medidas, visuales exactos y relaciones exactas) sin inventar nada.
