# Rodea · El Juego de las Provincias (MVP)

**Rodea** ("El Juego de las Provincias" como nombre provisional del proyecto)
es un juego web: te damos una cifra de habitantes, dibujas una zona libre
sobre el mapa de España y comprobamos cuánta gente vive realmente dentro.
Cuanto más te acerques al objetivo, más puntos (0–1000).

A pesar del nombre provisional, **el cálculo nunca usa provincias**: la
unidad mínima es la **celda de una rejilla de población** de ~1 km de lado.

## Stack

- **Next.js 15** (App Router) + **TypeScript estricto**
- **Tailwind CSS v4**
- **Mapa en `<canvas>` nativo** (proyección propia, contorno desde un
  GeoJSON local): sin librerías de mapas ni servidores de teselas
- **Turf.js** (`simplify` del trazo dibujado, intersecciones y áreas
  geodésicas del estimador municipal de referencia)
- **Web Worker** para el cálculo (no bloquea la interfaz)
- **Vitest** (unitarios) y **Playwright** (end-to-end)
- Estado local del navegador (localStorage); **sin base de datos, sin cuentas**
- Fuentes autoalojadas (Bricolage Grotesque + Inter, licencia OFL)

## Instalación y comandos

```bash
npm install
npm run dev          # desarrollo en http://localhost:3000
npm run build        # build de producción
npm start            # servir el build
npm test             # tests unitarios (Vitest)
npm run test:e2e     # test end-to-end (Playwright; requiere npx playwright install)
npx eslint .         # lint
npm run typecheck    # comprobación de tipos
npm run data:prepare        # pipeline de datos del estimador municipal de referencia
npm run data:validate       # validación de esos datos
npm run data:prepare-outline# regenera public/data/spain-outline.geojson desde es-atlas
```

El repositorio incluye los datos ya generados (`public/rejilla.bin`,
`public/rejilla_meta.json`, `public/data/spain-outline.geojson`), así que
`npm install && npm run dev` es suficiente para jugar.

## Cómo se estima la población

La fuente activa es una **rejilla de población** servida como binario
estático:

- `public/rejilla_meta.json` — metadatos: `min_lng`, `min_lat`, `step_lng`,
  `step_lat`, `count` (número de celdas) y `total_pob`.
- `public/rejilla.bin` — `count` registros de **8 bytes cada uno**: `i`
  (uint16 LE), `j` (uint16 LE), `poblacion` (uint32 LE). La posición real de
  cada celda es `lng = min_lng + i·step_lng`, `lat = min_lat + j·step_lat`
  (paso ≈ 1 km de lado).

```
población estimada = Σ población de la celda, para cada celda cuyo centro
                      cae dentro del polígono dibujado
```

- `lib/population/gridEstimator.ts` parsea el binario una vez (al iniciar el
  Web Worker) a arrays tipados, y en cada estimación filtra primero por la
  bounding box de la selección antes de comprobar
  punto-en-polígono (`@turf/boolean-point-in-polygon`) sobre los candidatos.
- El cálculo corre en un **Web Worker**: la interfaz nunca se bloquea.

**Limitación conocida:** no hay prorrateo de celdas de borde (una celda
cuenta entera o no cuenta), acotado por el tamaño de celda. Está explicado
al jugador en `/como-se-calcula`.

### Arquitectura del estimador

Toda la aplicación depende únicamente de la interfaz `PopulationEstimator`
(`lib/population/types.ts`):

```ts
interface PopulationEstimator {
  estimate(selection: Polygon | MultiPolygon): Promise<PopulationEstimate>;
}
```

`workers/population.worker.ts` instancia `GridEstimator` con los datos de
la rejilla. El repositorio conserva además `MunicipalEstimator`
(`lib/population/municipalEstimator.ts`), un prorrateo por superficie
municipal usado antes de adoptar la rejilla: no está conectado al worker,
pero implementa la misma interfaz y sigue teniendo tests, por si hace falta
comparar o volver a él. Sus datos de origen (INE + IGN, vía `es-atlas`) y el
pipeline que los genera (`npm run data:prepare`) están documentados en
[`data/raw/FUENTES.md`](data/raw/FUENTES.md).

Cambiar de estimador es una línea en `workers/population.worker.ts`; nada
más cambia (puntuación, UI, validación y tests de contrato siguen
funcionando).

## Tests

- **Unitarios (Vitest):** error porcentual, puntuación, over/under/exact,
  generación y persistencia del objetivo, estimación por rejilla (celda
  dentro/fuera, celdas de población 0, coherencia del binario), estimación
  municipal de referencia, selección vacía, geometría inválida (abierta,
  autointersectada, minúscula, fuera de España), formato numérico es-ES y
  reducer del juego. Los fixtures geográficos son artificiales y viven en
  `tests/unit/fixtures.ts`; **solo** se usan en tests.
- **End-to-end (Playwright):** una partida básica en viewport móvil: cargar,
  dibujar un polígono a mano alzada (arrastrar y soltar), comprobar, ver
  resultado y reintentar. Ejecuta antes `npx playwright install chromium`.

## Desplegar en Vercel

1. Sube el repositorio a GitHub (los datos generados de `public/` van
   incluidos en el repo: la rejilla de población pesa ~3,5 MB).
2. En Vercel: **New Project → importar el repo**. Framework preset: Next.js.
   Sin variables de entorno, sin base de datos, sin claves.
3. Deploy. Los datos se sirven como estáticos con caché de 1 día
   (configurada en `next.config.ts`).

## Estructura

```
app/                    páginas (juego, cómo-se-calcula, privacidad, acerca-de)
components/game/        GameHeader, TargetDisplay, SpainMap (mapa en canvas),
                        DrawingControls, ResultPanel, AttemptHistory, Game (orquestador)
lib/population/         types, estimator (interfaz), gridEstimator (activo),
                        municipalEstimator (referencia, no conectado), score
lib/geo/                spatialIndex, intersections, validation
lib/game/               target, storage, state
lib/analytics/          events (abstracción no conectada a ningún servicio)
workers/                population.worker.ts
scripts/                prepare-outline.mjs, prepare-municipal-data.mjs, validate-data.mjs
public/rejilla.bin, public/rejilla_meta.json   rejilla de población (activa)
public/data/            contorno de España + datos del estimador municipal de referencia
data/raw/               fuentes en bruto del estimador municipal + FUENTES.md
tests/unit/  tests/e2e/
```

## Limitaciones actuales

- Rejilla de ~1 km sin prorrateo de borde ⇒ una celda cuenta entera o no
  cuenta, según dónde caiga su centro respecto a tu línea.
- Un único polígono continuo por intento (el código ya contempla
  MultiPolygon en datos y validación).
- Selecciones muy grandes (media España) pueden tardar del orden de un
  segundo en calcular; se muestra el estado "Calculando…".
- Sin ranking social, cuentas ni analítica conectada (por diseño del MVP).
