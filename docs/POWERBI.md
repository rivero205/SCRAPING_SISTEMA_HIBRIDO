# Power BI — Entrega adaptada a SCRAPING_SISTEMA_HIBRIDO (Cartagena)

Esta guía adapta lo que pidió el profesor (inventario + modelo relacional + DAX + dashboard) a **nuestro proyecto**:

- **Fuente real de datos**: SQLite `data/barrios.db`
- **Tablas principales**:
  - `barrios` (dimensión: zona + infraestructura)
  - `propiedades` (hechos: oferta de arriendos scrapeados)

La idea es presentar esto como un **sistema híbrido**: Scraping → ETL → BD relacional → Power BI.

---

## 1) Responsable de Integración y Modelado (Data Architect)

Esta parte es el **Paso 1 completo** (tipo “hunde aquí, presiona allá”). La meta es:

1) Cargar datos sin errores
2) Dejar tipos correctos (Power Query)
3) Construir el modelo relacional (1 a muchos)
4) Validar que filtros funcionen

> Recomendación para la exposición: usa el modelo relacional con `dim_barrios` + `fact_propiedades` (+ fechas). Deja `fact_propiedades_enriquecida` como “tabla plana de apoyo” (no como base del modelo).

---

### 1.0 Requisitos previos (antes de Power BI)

Si ya cargaste los CSV, puedes saltarte esto. Si no:

1) En la carpeta del proyecto, genera/actualiza la BD (si aplica):
- `npm install`
- `npm start`
- `npm run sync`
- `npm run scraping`

2) Exporta a CSV para Power BI:
- `npm run export:powerbi`

Se crean los archivos en `data/powerbi/`.

---

### 1.1 Cargar datos a Power BI (desde CSV) — clic por clic

1) Abre **Power BI Desktop**
2) En la barra superior: **Inicio → Obtener datos → Texto/CSV**
3) Selecciona `dim_barrios.csv` → **Abrir**
4) En la ventana de previsualización:
  - Verifica que se vean los acentos (Cartagena, Pozón, etc.)
  - Pulsa **Transformar datos** (recomendado) o **Cargar** (si vas rápido)
5) Repite lo mismo para `fact_propiedades.csv`
6) (Opcional) Repite para `dim_fecha_scraping.csv`
7) (Opcional) Importa `fact_propiedades_enriquecida.csv` **solo si** quieres una tabla “flat” para comparar, pero **no** la uses para relaciones.

Si ya cargaste y ves las tablas en el panel de la derecha, vas bien.

---

### 1.2 Power Query (Transformar datos) — dejar tipos y limpieza mínima

1) Ve a: **Inicio → Transformar datos**
2) En el panel izquierdo, haz clic en `dim_barrios`
3) Revisa/ajusta tipos de columnas (en el encabezado de cada columna):
  - `id` → **Número entero**
  - `estrato` → **Número entero**
  - `latitud` y `longitud` → **Número decimal**
  - `area_km2` → **Número decimal**
  - `iluminacion_led` → **Número entero** (0/1) o **Verdadero/Falso** (si quieres)
  - `fecha_insercion` → **Fecha/Hora** (opcional; no es crítico para el modelo)

4) Ahora haz clic en `fact_propiedades`
5) Tipos recomendados:
  - `id` → **Número entero**
  - `barrio_id` → **Número entero** (IMPORTANTE: para que la relación funcione)
  - `precio_arriendo_cop`, `admin_cop`, `costo_total_cop` → **Número entero**
  - `area_m2` → **Número decimal**
  - `habitaciones`, `banos`, `parqueaderos` → **Número entero**
  - `pagina_scraping` → **Número entero**
  - `fecha_scraping` → **Fecha** (IMPORTANTE: para relación con fecha)
  - `hora_scraping` → Texto (está bien)

6) (Opcional recomendado) En `fact_propiedades`, crea una columna para precio/m² en Power Query:
  - **Agregar columna → Columna personalizada**
  - Nombre: `precio_m2`
  - Fórmula:
    - `if [area_m2] = null or [area_m2] = 0 or [precio_arriendo_cop] = null then null else [precio_arriendo_cop] / [area_m2]`
  - Tipo: **Número decimal**

7) En `dim_fecha_scraping`:
  - Asegura que `fecha_scraping` sea tipo **Fecha**

8) Cuando termines: **Inicio → Cerrar y aplicar**

---

### 1.3 Modelo relacional (relaciones) — clic por clic

Ahora vas a la vista de modelo (icono de diagrama a la izquierda).

#### Relación 1 (obligatoria): Barrios → Propiedades

1) **Modelo → Administrar relaciones → Nuevo**
2) Configura:
  - Tabla 1: `dim_barrios` columna `id`
  - Tabla 2: `fact_propiedades` columna `barrio_id`
  - Cardinalidad: **Uno a varios (1:*)**
  - Dirección de filtro cruzado: **Única** (desde `dim_barrios` hacia `fact_propiedades`)
  - Relación: **Activa**
3) **Aceptar**

✅ Verificación visual: debe verse un “1” del lado de `dim_barrios` y un “*” del lado de `fact_propiedades`.

#### Relación 2 (recomendada): Fecha → Propiedades

Si ya cargaste `dim_fecha_scraping`:

1) **Modelo → Administrar relaciones → Nuevo**
2) Configura:
  - `dim_fecha_scraping[fecha_scraping]` (1)
  - `fact_propiedades[fecha_scraping]` (*)
  - Cardinalidad: **Uno a varios (1:*)**
  - Dirección de filtro cruzado: **Única** (desde `dim_fecha_scraping` hacia `fact_propiedades`)
  - Activa
3) **Aceptar**

> Nota: una tabla calendario DAX completa es “más pro” (año/mes/semana), pero para la entrega básica `dim_fecha_scraping` funciona.

#### Importante: `fact_propiedades_enriquecida`

- Déjala **sin relaciones**.
- No la conectes a `dim_barrios`, porque ya trae `barrio_nombre`, `barrio_estrato`, lat/long y eso puede confundirte y generar conteos duplicados si la usas junto a `fact_propiedades`.

---

### 1.4 Validación (checklist de “si filtra bien, está bien”) — 3 minutos

1) Ve a la vista **Informe**
2) Crea una tabla simple con:
  - `dim_barrios[nombre]`
  - Un conteo: arrastra `fact_propiedades[id]` y cámbialo a **Recuento**
3) Agrega un segmentador (slicer) de `dim_barrios[estrato]`:
  - Al cambiar estrato, el conteo debe cambiar.
4) Agrega un segmentador de `dim_fecha_scraping[fecha_scraping]`:
  - Al cambiar fecha, el conteo debe cambiar.

Si ambos filtros afectan a `fact_propiedades`, el modelo está correcto.

---

### 1.5 Errores comunes (y cómo se arreglan)

- **No me deja crear la relación**
  - Causa #1: tipos distintos. Solución: en Power Query, fuerza `dim_barrios[id]` y `fact_propiedades[barrio_id]` a **Número entero**.
  - Causa #2: `dim_barrios[id]` con duplicados. Solución: revisar duplicados en Power Query y corregir fuente.

- **La relación se crea pero no filtra**
  - Revisa que la relación esté **Activa**.
  - Revisa que la dirección de filtro esté en **Única** desde la dimensión a la tabla de hechos.

- **Fecha no se puede convertir**
  - Solución: en Power Query revisa el formato real y usa “Cambiar tipo → Usar configuración regional…” y elige Español (Colombia) si está en formato dd/mm.

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
