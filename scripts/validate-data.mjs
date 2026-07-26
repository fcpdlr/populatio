#!/usr/bin/env node
/**
 * Valida los datos publicados en public/data.
 * Falla (exit 1) si la aplicación no debería publicarse con estos datos.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "data");
const SPAIN_BBOX = [-19.2, 26.8, 5.3, 44.7];

const errors = [];
const warnings = [];

function check(cond, message, level = "error") {
  if (!cond) (level === "error" ? errors : warnings).push(message);
}

const metaPath = path.join(OUT, "metadata.json");
const geoPath = path.join(OUT, "municipalities.optimized.geojson");
const indexPath = path.join(OUT, "municipalities.index.json");

check(existsSync(metaPath), "Falta public/data/metadata.json (ejecuta npm run data:prepare)");
check(existsSync(geoPath), "Falta public/data/municipalities.optimized.geojson");
check(existsSync(indexPath), "Falta public/data/municipalities.index.json");

if (errors.length === 0) {
  const metadata = JSON.parse(readFileSync(metaPath, "utf8"));
  const collection = JSON.parse(readFileSync(geoPath, "utf8"));
  const index = JSON.parse(readFileSync(indexPath, "utf8"));

  check(
    collection.features.length === metadata.municipalityCount,
    `El geojson tiene ${collection.features.length} municipios pero metadata declara ${metadata.municipalityCount}`,
  );
  check(
    index.length === metadata.municipalityCount,
    "El índice no coincide con metadata.municipalityCount",
  );
  check(metadata.municipalityCount > 8000, "Menos de 8.000 municipios: datos incompletos");
  check(
    metadata.populationYear >= 2020,
    `Año de población sospechosamente antiguo: ${metadata.populationYear}`,
    "warning",
  );

  let total = 0;
  const codes = new Set();
  let badCoords = 0;
  let badProps = 0;

  for (const f of collection.features) {
    const p = f.properties;
    if (
      !p ||
      !/^\d{5}$/.test(p.municipalityCode) ||
      !Number.isFinite(p.population) ||
      p.population < 0 ||
      !Number.isFinite(p.totalAreaM2) ||
      p.totalAreaM2 <= 0 ||
      !Array.isArray(p.bbox) ||
      p.bbox.length !== 4
    ) {
      badProps += 1;
      continue;
    }
    if (codes.has(p.municipalityCode)) badProps += 1;
    codes.add(p.municipalityCode);
    total += p.population;
    const [minX, minY, maxX, maxY] = p.bbox;
    if (
      minX < SPAIN_BBOX[0] || minY < SPAIN_BBOX[1] ||
      maxX > SPAIN_BBOX[2] || maxY > SPAIN_BBOX[3]
    ) {
      badCoords += 1;
    }
  }

  check(badProps === 0, `${badProps} municipios con propiedades inválidas o duplicadas`);
  check(badCoords === 0, `${badCoords} municipios con coordenadas fuera del rango esperado de España`);
  check(
    total === metadata.totalPopulation,
    `Población total (${total}) no coincide con metadata (${metadata.totalPopulation})`,
  );
  check(
    total > 40_000_000 && total < 55_000_000,
    `Población total fuera de rango plausible: ${total}`,
  );
}

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error("\nValidación FALLIDA: no publiques la aplicación con estos datos.");
  process.exit(1);
}
console.log("✓ Datos válidos: municipios, población total y rangos de coordenadas correctos.");
