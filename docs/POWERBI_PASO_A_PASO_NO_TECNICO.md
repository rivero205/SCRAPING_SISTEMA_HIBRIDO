# Power BI: solo parte grafica (paso a paso, sin tecnicismos)

Este documento es unicamente para armar la parte visual del dashboard.
Asume que ya tienes los datos, relaciones y medidas listas.

Objetivo: que te quede bonito, claro y facil de explicar.

---

## 1) Pagina 1 - Panorama Cartagena

### 1.1 Crear y nombrar pagina

1. Abre Power BI Desktop.
2. Abajo, en la pestana de hoja, haz clic derecho sobre la pagina actual.
3. Presiona **Cambiar nombre**.
4. Escribe: **Panorama Cartagena**.

### 1.2 Fondo de la pagina

1. Haz clic en un espacio vacio (sin seleccionar ningun grafico).
2. En el panel derecho, abre **Formato de pagina**.
3. En **Fondo del lienzo** configura:
- Color: `#F7FAFC`
- Transparencia: `0%`

### 1.3 Titulo principal

1. Arriba presiona **Insertar**.
2. Presiona **Cuadro de texto**.
3. Escribe exactamente:

`Panorama de Arriendos - Cartagena`

4. Con el texto seleccionado, en formato del texto coloca:
- Tamano: `24`
- Negrita: `Activada`
- Color: `#0B1F3A`

5. Mueve el titulo a la parte superior centrada.

---

## 2) Tarjetas KPI (fila superior)

Vas a crear 4 tarjetas.

### 2.1 Tarjeta 1 - Total ofertas

1. En **Visualizaciones**, haz clic en **Tarjeta**.
2. Arrastra la medida `Total Ofertas` al campo de valores.
3. En **Formato del visual** configura:
- Titulo: `Total Ofertas`
- Color del titulo: `#0B1F3A`
- Etiqueta de datos (numero): tamano `20`, color `#123B5D`
- Fondo: `#FFFFFF`
- Transparencia del fondo: `0%`
- Sombra: `Activada` (suave)

### 2.2 Tarjeta 2 - Precio promedio

1. Duplica la tarjeta anterior (Ctrl+C, Ctrl+V).
2. En valores, cambia a `Precio Promedio`.
3. Titulo: `Precio Promedio (COP)`.
4. En formato de numero, usa separador de miles.

### 2.3 Tarjeta 3 - Mediana precio

1. Duplica otra vez.
2. Cambia valor a `Mediana Precio`.
3. Titulo: `Mediana Precio (COP)`.

### 2.4 Tarjeta 4 - Precio m2

1. Duplica otra vez.
2. Cambia valor a `Precio m2 Promedio`.
3. Titulo: `Precio m2 Promedio (COP)`.

### 2.5 Alinear tarjetas perfectas

1. Selecciona las 4 tarjetas (Ctrl + clic en cada una).
2. Arriba en la cinta, presiona **Formato**.
3. Presiona **Alinear** -> **Alinear arriba**.
4. Presiona **Distribuir** -> **Distribuir horizontalmente**.

Resultado esperado: 4 tarjetas en una sola fila, limpias y simetricas.

---

## 3) Grafico 1 - Top 10 barrios con mas oferta

### 3.1 Insertar grafico

1. Haz clic en **Grafico de barras agrupadas**.
2. Arrastra `dim_barrios[nombre]` al eje.
3. Arrastra la medida `Total Ofertas` a valores.

### 3.2 Limitar a Top 10

1. Con el grafico seleccionado, abre panel **Filtros**.
2. En el filtro de `dim_barrios[nombre]`, cambia tipo a **Top N**.
3. Escribe `10`.
4. En "Por valor" arrastra `Total Ofertas`.
5. Presiona **Aplicar filtro**.

### 3.3 Formato visual

En **Formato del visual** coloca:
- Titulo: `Top 10 barrios con mas oferta`
- Color barras: `#1F77B4`
- Etiquetas de datos: `Activadas`
- Tamano de texto etiquetas: `10` o `11`
- Lineas de cuadrícula: `Desactivadas` (opcional para que se vea mas limpio)
- Fondo del visual: `#FFFFFF`, transparencia `0%`
- Borde suave o sombra suave: `Activado`

---

## 4) Grafico 2 - Precio promedio por estrato

### 4.1 Insertar grafico

1. Haz clic en **Grafico de columnas agrupadas**.
2. Eje X: `dim_barrios[estrato]`.
3. Valores: `Precio Promedio`.

### 4.2 Formato visual

- Titulo: `Precio promedio por estrato`
- Color columnas: `#2A9D8F`
- Etiquetas de datos: `Activadas`
- Eje Y: separador de miles `Activado`
- Fondo del visual: `#FFFFFF`
- Sombra suave: `Activada`

---

## 5) Pagina 2 - Mapa y detalle

### 5.1 Crear pagina nueva

1. Abajo, haz clic en **+** (nueva pagina).
2. Cambia nombre a: **Mapa y Detalle**.
3. Aplica el mismo fondo de pagina:
- `#F7FAFC`
- Transparencia `0%`

### 5.2 Titulo de pagina

1. Insertar -> Cuadro de texto.
2. Escribe:

`Mapa de oferta y precios por barrio`

3. Formato:
- Tamano `22`
- Negrita activada
- Color `#0B1F3A`

### 5.3 Mapa de burbujas

1. Inserta visual **Mapa**.
2. Arrastra campos:
- Latitud: `dim_barrios[latitud]`
- Longitud: `dim_barrios[longitud]`
- Tamano: `Total Ofertas`
- Leyenda (opcional): `dim_barrios[estrato]`
- Color saturacion (si aparece en tu version): `Precio Promedio`

3. Formato:
- Titulo: `Oferta y precio por barrio`
- Zoom automatico: activado
- Fondo: `#FFFFFF`
- Sombra suave: activada

### 5.4 Tabla de detalle

1. Inserta visual **Tabla**.
2. Agrega estas columnas/medidas:
- `dim_barrios[nombre]`
- `dim_barrios[estrato]`
- `Total Ofertas`
- `Precio Promedio`
- `Precio m2 Promedio`

3. Formato:
- Titulo: `Detalle por barrio`
- Encabezados en negrita
- Tamano texto: `10` u `11`
- Fondo: `#FFFFFF`
- Filas alternadas: gris muy claro (opcional)

---

## 6) Filtros visuales (slicers)

Pon los filtros en el lado izquierdo de ambas paginas.

### 6.1 Slicer de estrato

1. Inserta **Segmentacion de datos**.
2. Campo: `dim_barrios[estrato]`.
3. Titulo: `Filtrar por estrato`.
4. Tipo: **Desplegable**.

### 6.2 Slicer tipo de inmueble

1. Inserta otro slicer.
2. Campo: `fact_propiedades[tipo_inmueble]`.
3. Titulo: `Filtrar por tipo de inmueble`.

### 6.3 Slicer fecha

1. Inserta otro slicer.
2. Campo: `dim_fecha_scraping[fecha_scraping]`.
3. Titulo: `Filtrar por fecha`.
4. Tipo recomendado: **Entre** (para rango de fechas).

### 6.4 Slicers de contexto barrio

- Campo: `dim_barrios[estado_pavimento]` -> titulo `Estado del pavimento`
- Campo: `dim_barrios[iluminacion_led]` -> titulo `Iluminacion LED`

### 6.5 Sincronizar slicers entre paginas

1. Selecciona un slicer.
2. Ve a **Vista** -> **Sincronizacion de segmentaciones**.
3. Marca que se vea y filtre en ambas paginas.
4. Repite con los slicers principales.

---

## 7) Paleta exacta (usa solo estos colores)

- Azul principal: `#1F77B4`
- Verde apoyo: `#2A9D8F`
- Azul oscuro texto: `#0B1F3A`
- Fondo pagina: `#F7FAFC`
- Fondo tarjetas/graficos: `#FFFFFF`

Regla simple:
- Azul para volumen/oferta.
- Verde para precio/promedio.

---

## 8) Orden visual recomendado (layout)

### Pagina 1

- Arriba: titulo.
- Debajo del titulo: 4 tarjetas KPI en una sola fila.
- Parte media izquierda: Top 10 barrios.
- Parte media derecha: Precio por estrato.
- Lado izquierdo (columna): slicers.

### Pagina 2

- Arriba: titulo.
- Centro izquierda: mapa.
- Centro derecha o parte inferior: tabla detalle.
- Lado izquierdo: slicers.

---

## 9) Revision final rapida (solo parte grafica)

Antes de cerrar, revisa:

1. Todos los titulos estan claros y bien escritos.
2. Todos los graficos tienen fondo blanco y sombra suave.
3. No hay colores raros fuera de la paleta.
4. Las tarjetas estan alineadas y del mismo tamano.
5. Los slicers estan en la misma zona en ambas paginas.
6. No hay saturacion: maximo 6-8 visuales por pagina.

Si todo eso se cumple, la parte grafica ya esta lista para presentar.
