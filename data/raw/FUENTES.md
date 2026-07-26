# Procedencia de los datos en bruto

## poblacion-ine-2023.json

Cifras oficiales de población de los municipios españoles (revisión del
Padrón municipal) a **1 de enero de 2023**, elaboradas por el **Instituto
Nacional de Estadística (INE)**.

- Operación estadística: "Cifras oficiales de población de los municipios
  españoles: Revisión del Padrón Municipal" (INE).
- Página oficial: https://www.ine.es/dynt3/inebase/index.htm?padre=525
- 8.131 municipios · 48.085.361 habitantes en total (cifra oficial).
- Obtención: volcado publicado en GitHub
  (Carlosfpc/poblacion-municipios-provincias-comunidades-espana-2023,
  descargado el 15/07/2026) y **verificado** contra las cifras oficiales:
  número exacto de municipios, total nacional exacto y contraste puntual de
  Madrid (3.340.176), Barcelona (1.655.956), Córdoba (324.418),
  Ceuta (83.052) y Melilla (85.493).
- Formato: `{ "28079": { "name": "Madrid", "province": "28", "population": 3340176 }, ... }`
  con el código INE de 5 dígitos como clave.

Para actualizar a un año más reciente, descarga el fichero pobmun del INE,
expórtalo como CSV `codigo;nombre;poblacion` y guárdalo como
`data/raw/poblacion.csv`: el pipeline lo usará con prioridad.

## municipios.geojson (opcional, no incluido)

Límites municipales oficiales del **IGN/CNIG** ("Líneas límite
municipales"), descargables en https://centrodedescargas.cnig.es.
Convierte el shapefile a GeoJSON (WGS84 / EPSG:4326), por ejemplo con
mapshaper u ogr2ogr, y guárdalo aquí como `municipios.geojson`. El pipeline
lo usará con prioridad sobre el respaldo de es-atlas.

## Respaldo de geometrías: es-atlas

Si no existe `municipios.geojson`, el pipeline usa el paquete npm
`es-atlas` (0.6.0, MIT), un TopoJSON simplificado generado a partir del
Equipamiento Geográfico de Referencia Nacional del IGN.
