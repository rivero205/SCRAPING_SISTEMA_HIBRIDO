# 📊 Análisis DAX — Modelo Inmobiliario (Sistema Híbrido de Scraping)

> **Rama:** `2-logica-dax_tablas`
> **Paso:** 2 — Lógica y Análisis (DAX Specialist)
> **Fecha:** 2026-04-23

---

## Modelo de Datos — Tablas Reales del Proyecto

| Tabla | Rol | Columnas Clave |
|---|---|---|
| `fact_propiedades_enriquecida` | Hechos (principal) | `id`, `barrio_id`, `tipo_inmueble`, `precio_arriendo_cop`, `admin_cop`, `costo_total_cop`, `area_m2`, `habitaciones`, `banos`, `parqueaderos`, `fecha_scraping`, `barrio_nombre`, `barrio_estrato` |
| `fact_propiedades` | Hechos (secundaria) | `id`, `barrio_id`, `tipo_inmueble`, `precio_arriendo_cop`, `admin_cop`, `costo_total_cop`, `area_m2`, `fecha_scraping` |
| `dim_barrios` | Dimensión (zona) | `id`, `nombre`, `slug`, `estrato`, `latitud`, `longitud`, `area_km2`, `estado_pavimento`, `iluminacion_led` |
| `dim_fecha_scraping` | Dimensión (tiempo) | `fecha_scraping` |

### Relaciones del Modelo Estrella

```
dim_barrios (1) ───────── (N) fact_propiedades_enriquecida
   [id]                         [barrio_id]

dim_fecha_scraping (1) ── (N) fact_propiedades_enriquecida
   [fecha_scraping]             [fecha_scraping]
```

---

## 1. Creación de Medidas DAX

> Todas las medidas se crean en la tabla `fact_propiedades_enriquecida`.
> Para crearlas en Power BI: **Pestaña "Modelado" → "Nueva medida"** y pegar el código.

---

### 1.1 Total Oferta *(Equivalente a Stock Total)*

Conteo total de propiedades extraídas por el scraping.

```dax
Total Oferta =
COUNTROWS( fact_propiedades_enriquecida )
```

**Uso:** Tarjeta KPI principal. Muestra cuántos registros inmobiliarios se extrajeron.
Al filtrar por `dim_barrios[nombre]` o `dim_barrios[estrato]`, el valor se ajustará automáticamente mostrando solo las propiedades de ese barrio/estrato.

---

### 1.2 Valorización del Mercado — Sumatoria de Precios

Sumatoria total del precio de arriendo de todas las propiedades publicadas.

```dax
Valorizacion Mercado Total =
SUM( fact_propiedades_enriquecida[precio_arriendo_cop] )
```

**Uso:** Representa el volumen monetario total del mercado de arriendos capturado por el scraping. Ideal para tarjetas KPI o visualizaciones comparativas por zona.

---

### 1.3 Valorización del Mercado — Precio Promedio

Promedio del precio de arriendo por propiedad.

```dax
Precio Promedio Arriendo =
AVERAGE( fact_propiedades_enriquecida[precio_arriendo_cop] )
```

**Uso:** KPI clave para análisis comparativo. Permite saber el costo promedio de arriendo en el mercado capturado y comparar entre zonas al segmentar con `dim_barrios`.

---

### 1.4 Densidad por Zona *(Equivalente a Rendimiento por Empleado)*

Cantidad de propiedades por cada barrio registrado en la dimensión `dim_barrios`.

```dax
Densidad por Zona =
DIVIDE(
    COUNTROWS( fact_propiedades_enriquecida ),
    DISTINCTCOUNT( dim_barrios[id] ),
    0
)
```

**Explicación:**
- **Numerador:** cuenta total de propiedades (en el contexto de filtro activo).
- **Denominador:** cantidad de barrios distintos presentes en `dim_barrios`.
- **Tercer argumento (`0`):** valor por defecto si el denominador es cero (evita errores de división).

**Uso:** Indica, en promedio, cuántas propiedades hay por barrio. Si se aplica un slicer por estrato, el cálculo se actualiza dinámicamente mostrando la densidad de oferta solo para los barrios de ese estrato.

---

### 1.5 Tasa de Datos Incompletos *(Control de Calidad del Scraping)*

Porcentaje de registros donde el precio **o** el área vienen nulos, vacíos o en cero. Esto simula las anomalías del ejemplo original de inventario y mide la calidad del scraping.

```dax
Tasa Datos Incompletos =
VAR _TotalRegistros = COUNTROWS( fact_propiedades_enriquecida )
VAR _RegistrosIncompletos =
    COUNTROWS(
        FILTER(
            fact_propiedades_enriquecida,
            ISBLANK( fact_propiedades_enriquecida[precio_arriendo_cop] )
            || fact_propiedades_enriquecida[precio_arriendo_cop] = 0
            || ISBLANK( fact_propiedades_enriquecida[area_m2] )
            || fact_propiedades_enriquecida[area_m2] = 0
        )
    )
RETURN
    DIVIDE( _RegistrosIncompletos, _TotalRegistros, 0 )
```

**Formato recomendado:** Cambiar el formato de la medida a **Porcentaje** en Power BI (pestaña Modelado → Formato → Porcentaje).

**Uso:** Un KPI de control que permite identificar qué proporción de los datos del scraping tiene información incompleta. Si se filtra por barrio, se puede detectar en qué zonas el scraper tiene mayor tasa de fallos.

---

### 1.6 Medidas Complementarias (Recomendadas)

Estas medidas adicionales enriquecen el análisis y son útiles para los dashboards.

```dax
-- Costo Total Promedio (arriendo + administración)
Costo Total Promedio =
AVERAGE( fact_propiedades_enriquecida[costo_total_cop] )
```

```dax
-- Mediana de Precio (más robusta que el promedio ante outliers)
Mediana Precio =
MEDIANX(
    fact_propiedades_enriquecida,
    fact_propiedades_enriquecida[precio_arriendo_cop]
)
```

```dax
-- Cantidad de Barrios con Oferta activa
Barrios con Oferta =
DISTINCTCOUNT( fact_propiedades_enriquecida[barrio_id] )
```

---

## 2. Columnas Calculadas

> Las columnas calculadas se crean dentro de `fact_propiedades_enriquecida`.
> Para crearlas en Power BI: **Click derecho sobre la tabla → "Nueva columna"** y pegar el código.

---

### 2.1 Alerta de Precio *(Equivalente a "Stock Bajo" / "Prioridad")*

Lógica condicional que categoriza cada propiedad comparando su precio contra el promedio global del mercado.

```dax
Alerta de Precio =
VAR _PrecioPropiedad = fact_propiedades_enriquecida[precio_arriendo_cop]
VAR _PromedioGlobal =
    CALCULATE(
        AVERAGE( fact_propiedades_enriquecida[precio_arriendo_cop] ),
        ALL( fact_propiedades_enriquecida )
    )
RETURN
    IF(
        ISBLANK( _PrecioPropiedad ) || _PrecioPropiedad = 0,
        "Sin Precio",
        IF(
            _PrecioPropiedad < _PromedioGlobal,
            "Precio Atractivo",
            "Precio Elevado"
        )
    )
```

**Categorías resultantes:**

| Valor | Significado |
|---|---|
| `Precio Atractivo` | El arriendo está **por debajo** del promedio global del mercado. |
| `Precio Elevado` | El arriendo está **por encima** del promedio global del mercado. |
| `Sin Precio` | El registro no tiene precio (dato incompleto del scraping). |

**Uso en gráficos:** Úsala como leyenda o eje de segmentación en gráficos de barras y donas para visualizar la distribución de propiedades atractivas vs. elevadas.

---

### 2.1.1 Alerta de Precio por Zona (Variante Avanzada)

Compara el precio de cada propiedad contra el promedio **de su propio barrio**, ofreciendo un análisis más justo y contextualizado.

```dax
Alerta Precio Zona =
VAR _PrecioPropiedad = fact_propiedades_enriquecida[precio_arriendo_cop]
VAR _BarrioActual = fact_propiedades_enriquecida[barrio_id]
VAR _PromedioZona =
    CALCULATE(
        AVERAGE( fact_propiedades_enriquecida[precio_arriendo_cop] ),
        FILTER(
            ALL( fact_propiedades_enriquecida ),
            fact_propiedades_enriquecida[barrio_id] = _BarrioActual
        )
    )
RETURN
    IF(
        ISBLANK( _PrecioPropiedad ) || _PrecioPropiedad = 0,
        "Sin Precio",
        IF(
            _PrecioPropiedad < _PromedioZona,
            "Precio Atractivo (Zona)",
            "Precio Elevado (Zona)"
        )
    )
```

---

### 2.2 Antigüedad de la Publicación

Diferencia en días entre la fecha de extracción (`fecha_scraping` desde `dim_fecha_scraping`) y la fecha de inserción del registro, categorizando cada publicación por su antigüedad.

> **Nota:** Dado que nuestro modelo tiene una única fecha de scraping (`2026-03-06`), la antigüedad se calcula contra la columna `fecha_insercion` de la tabla de hechos para obtener variación real. Si tu modelo crece con múltiples corridas de scraping, la diferencia será más significativa.

```dax
Antiguedad Publicacion =
VAR _FechaScraping = fact_propiedades_enriquecida[fecha_scraping]
VAR _FechaInsercion = fact_propiedades_enriquecida[fecha_insercion]
VAR _DiferenciaEnDias =
    DATEDIFF( _FechaInsercion, _FechaScraping, DAY )
RETURN
    SWITCH(
        TRUE(),
        ISBLANK( _FechaInsercion ) || ISBLANK( _FechaScraping ),
            "Sin Fecha",
        _DiferenciaEnDias <= 7,
            "Reciente",
        _DiferenciaEnDias <= 30,
            "Estándar",
        "Antigua"
    )
```

**Categorías resultantes:**

| Valor | Criterio |
|---|---|
| `Reciente` | La publicación tiene **7 días o menos** desde su inserción hasta la extracción. |
| `Estándar` | Entre **8 y 30 días**. |
| `Antigua` | Más de **30 días**. |
| `Sin Fecha` | Alguna de las fechas es nula (dato incompleto). |

**Uso en gráficos:** Segmentar las publicaciones por antigüedad en gráficos de dona o barras apiladas para identificar qué tan "fresco" es el mercado capturado.

---

### 2.2.1 Días Exactos de Antigüedad (Columna Numérica Auxiliar)

Columna numérica útil para rangos personalizados y tooltips en gráficos.

```dax
Dias Antiguedad =
VAR _FechaScraping = fact_propiedades_enriquecida[fecha_scraping]
VAR _FechaInsercion = fact_propiedades_enriquecida[fecha_insercion]
RETURN
    IF(
        ISBLANK( _FechaInsercion ) || ISBLANK( _FechaScraping ),
        BLANK(),
        DATEDIFF( _FechaInsercion, _FechaScraping, DAY )
    )
```

---

## 3. Validación de Datos

### 3.1 Validación Cruzada — Medidas DAX vs. Datos Crudos

Para garantizar la integridad de los datos, los valores calculados en DAX deben coincidir **exactamente** con los datos de los archivos CSV fuente del scraping.

#### Comprobaciones obligatorias:

| Verificación | Fórmula DAX | Validación en CSV / SQL |
|---|---|---|
| **Conteo total** | `COUNTROWS(fact_propiedades_enriquecida)` | `SELECT COUNT(*) FROM propiedades` en SQLite **o** contar filas en `fact_propiedades_enriquecida.csv` (restar 1 por el header). |
| **Suma de precios** | `SUM(fact_propiedades_enriquecida[precio_arriendo_cop])` | `SELECT SUM(precio_arriendo_cop) FROM propiedades` en SQLite. |
| **Precio promedio** | `AVERAGE(fact_propiedades_enriquecida[precio_arriendo_cop])` | `SELECT AVG(precio_arriendo_cop) FROM propiedades` en SQLite. |
| **Registros sin precio** | Usar la medida `Tasa Datos Incompletos` × Total | `SELECT COUNT(*) FROM propiedades WHERE precio_arriendo_cop IS NULL OR precio_arriendo_cop = 0` |

#### Pasos para validar:

1. **En Power BI**, crea una tabla/matrix sin filtros y verifica que `Total Oferta` = número de filas del CSV (sin header).
2. **En SQLite** (o abriendo el CSV en Excel), ejecuta las queries de la tabla anterior.
3. **Compara los valores**. Si hay discrepancia:
   - Revisar si Power Query eliminó filas al importar (filtros automáticos por tipo).
   - Verificar que no haya filas duplicadas en el CSV.
   - Confirmar que los tipos de dato están correctos (precio como número, no texto).

---

### 3.2 Validación de Relaciones — Integridad del Modelo Estrella

La relación **1 a muchos** entre `dim_barrios` y `fact_propiedades_enriquecida` es fundamental para que las medidas respondan correctamente a los filtros.

#### ¿Cómo debe responder el modelo al filtrar por `dim_barrios`?

```
┌──────────────────────────────┐
│        dim_barrios           │
│  (filtro: nombre = "Manga") │
└────────────┬─────────────────┘
             │  Relación: dim_barrios[id] → fact_propiedades_enriquecida[barrio_id]
             │  Cardinalidad: 1 a muchos
             ▼
┌──────────────────────────────────────────┐
│     fact_propiedades_enriquecida         │
│  (solo filas donde barrio_id = id de    │
│   "Manga" se incluyen en el cálculo)    │
└──────────────────────────────────────────┘
```

**Comportamiento esperado:**

- Al seleccionar un barrio en un slicer de `dim_barrios[nombre]`, **todas** las medidas (`Total Oferta`, `Precio Promedio Arriendo`, `Densidad por Zona`, etc.) se recalculan automáticamente para mostrar solo los datos de ese barrio.
- Al filtrar por `dim_barrios[estrato]`, se muestran solo las propiedades cuyos barrios pertenecen a ese estrato.
- La medida `Densidad por Zona` se recalcula considerando solo los barrios del filtro activo.

#### Comprobaciones obligatorias para las relaciones:

| Verificación | Cómo Validar |
|---|---|
| **Sin IDs huérfanos** | Verificar que todo `barrio_id` en `fact_propiedades_enriquecida` exista en `dim_barrios[id]`. En Power Query: hacer un merge (Left Anti Join) entre las tablas; el resultado debe ser vacío. |
| **Clave primaria única** | `dim_barrios[id]` no debe tener duplicados. Validar con `COUNTROWS(dim_barrios) = DISTINCTCOUNT(dim_barrios[id])`. |
| **Filtro cruzado funcional** | Colocar un slicer de `dim_barrios[nombre]` y una tarjeta con `Total Oferta`. Al seleccionar un barrio, la tarjeta debe cambiar de valor. Si no cambia, la relación no está configurada. |
| **Dirección del filtro** | La relación debe filtrar en dirección **Dimensión → Hechos** (Single direction). Esto es el comportamiento por defecto de Power BI para relaciones 1:N. |

---

### 3.3 Checklist Rápido de Validación

- [ ] `COUNTROWS(fact_propiedades_enriquecida)` = filas del CSV - 1
- [ ] `SUM(precio_arriendo_cop)` en DAX = `SUM` en SQLite/Excel
- [ ] No hay `barrio_id` huérfanos (Anti Join vacío)
- [ ] `dim_barrios[id]` es única (sin duplicados)
- [ ] Al filtrar por barrio, los KPIs cambian correctamente
- [ ] Al filtrar por estrato, los KPIs cambian correctamente
- [ ] La columna `Alerta de Precio` tiene 3 categorías visibles en la tabla
- [ ] La columna `Antiguedad Publicacion` tiene las 4 categorías esperadas
- [ ] El formato de `Tasa Datos Incompletos` es porcentaje (%)

---

## 4. Resumen de Fórmulas — Copia Rápida

### Medidas (crear en `fact_propiedades_enriquecida`)

| # | Nombre | Fórmula |
|---|---|---|
| 1 | Total Oferta | `COUNTROWS( fact_propiedades_enriquecida )` |
| 2 | Valorizacion Mercado Total | `SUM( fact_propiedades_enriquecida[precio_arriendo_cop] )` |
| 3 | Precio Promedio Arriendo | `AVERAGE( fact_propiedades_enriquecida[precio_arriendo_cop] )` |
| 4 | Densidad por Zona | `DIVIDE( COUNTROWS(...), DISTINCTCOUNT(dim_barrios[id]), 0 )` |
| 5 | Tasa Datos Incompletos | `DIVIDE( _RegistrosIncompletos, _TotalRegistros, 0 )` |
| 6 | Costo Total Promedio | `AVERAGE( fact_propiedades_enriquecida[costo_total_cop] )` |
| 7 | Mediana Precio | `MEDIANX( fact_propiedades_enriquecida, ...[precio_arriendo_cop] )` |
| 8 | Barrios con Oferta | `DISTINCTCOUNT( fact_propiedades_enriquecida[barrio_id] )` |

### Columnas Calculadas (crear en `fact_propiedades_enriquecida`)

| # | Nombre | Tipo |
|---|---|---|
| 1 | Alerta de Precio | Texto (IF comparando vs promedio global) |
| 2 | Alerta Precio Zona | Texto (IF comparando vs promedio del barrio) |
| 3 | Antiguedad Publicacion | Texto (SWITCH: Reciente / Estándar / Antigua) |
| 4 | Dias Antiguedad | Número (DATEDIFF en días) |

---

> **📌 Instrucciones para aplicar en Power BI Desktop:**
>
> 1. Abrir `sistema_hibrido.pbix`
> 2. Para cada **medida**: ir a la pestaña *Modelado* → *Nueva medida* → pegar el código DAX
> 3. Para cada **columna calculada**: click derecho en `fact_propiedades_enriquecida` → *Nueva columna* → pegar el código DAX
> 4. Verificar los formatos: precio en *Moneda (COP)*, tasa en *Porcentaje*, conteos en *Número entero*
> 5. Ejecutar el checklist de validación de la sección 3.3
