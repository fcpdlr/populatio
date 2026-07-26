#!/usr/bin/env node
/**
 * Pipeline de preparación de datos municipales.
 *
 * Entradas (por orden de preferencia):
 *
 *  GEOMETRÍAS
 *   1. data/raw/municipios.geojson — GeoJSON derivado de los límites
 *      municipales oficiales del IGN/CNIG ("Líneas límite municipales",
 *      https://centrodedescargas.cnig.es). Se detectan automáticamente los
 *      campos NATCODE / CODIGOINE / COD_INE / id.
 *   2. node_modules/es-atlas/es/municipalities.json — TopoJSON generado a
 *      partir del Equipamiento Geográfico de Referencia Nacional del IGN
 *      (proyecto es-atlas, MIT). Es el respaldo incluido para que el juego
 *      funcione sin descargas manuales.
 *
 *  POBLACIÓN
 *   1. data/raw/poblacion.csv — CSV con cabecera `codigo;nombre;poblacion`
 *      (separador ; o ,) generado a partir del fichero oficial del INE
 *      "Cifras oficiales de población de los municipios" (pobmun,
 *      https://www.ine.es/dynt3/inebase/index.htm?padre=525).
 *   2. data/raw/poblacion-ine-2023.json — cifras oficiales del Padrón a
 *      1/1/2023 (8.131 municipios, 48.085.361 habitantes) incluidas en el
 *      repositorio. Ver data/raw/FUENTES.md para la procedencia.
 *
 * Salidas:
 *   public/data/municipalities.optimized.geojson
 *   public/data/municipalities.index.json
 *   public/data/metadata.json
 *   data/report.json (informe de validación del pipeline)
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { feature as topoToGeo } from "topojson-client";
import areaFn from "@turf/area";
import bboxFn from "@turf/bbox";
import truncate from "@turf/truncate";
import kinksFn from "@turf/kinks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "public", "data");

const POPULATION_YEAR = 2023;
const SCHEMA_VERSION = 1;
const SPAIN_BBOX = [-18.6, 27.3, 4.7, 44.2];

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

/* ------------------------------------------------------------------ */
/* 1. Cargar geometrías                                                */
/* ------------------------------------------------------------------ */

function normalizeCode(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // NATCODE del IGN: 34 + CA(2) + PROV(2) + MUN(5) → últimos 5 dígitos
  if (/^\d{11}$/.test(s)) s = s.slice(-5);
  if (/^\d{1,5}$/.test(s)) return s.padStart(5, "0");
  return null;
}

function loadGeometries() {
  const officialPath = path.join(RAW, "municipios.geojson");
  if (existsSync(officialPath)) {
    log(`→ Geometrías: fichero oficial ${path.relative(ROOT, officialPath)}`);
    const fc = JSON.parse(readFileSync(officialPath, "utf8"));
    const features = fc.features.map((f) => {
      const p = f.properties ?? {};
      const code = normalizeCode(
        p.NATCODE ?? p.natcode ?? p.CODIGOINE ?? p.COD_INE ?? p.codigo ?? f.id,
      );
      const name = p.NAMEUNIT ?? p.nameunit ?? p.NOMBRE ?? p.nombre ?? p.name ?? "";
      return { code, name, geometry: f.geometry };
    });
    return {
      features,
      source:
        "IGN/CNIG — Líneas límite municipales (fichero aportado manualmente en data/raw/municipios.geojson)",
    };
  }

  const atlasPath = path.join(
    ROOT,
    "node_modules",
    "es-atlas",
    "es",
    "municipalities.json",
  );
  if (!existsSync(atlasPath)) {
    throw new Error(
      "No hay geometrías: coloca data/raw/municipios.geojson o instala devDependencies (es-atlas).",
    );
  }
  log("→ Geometrías: es-atlas (TopoJSON derivado del IGN, respaldo incluido)");
  const topo = JSON.parse(readFileSync(atlasPath, "utf8"));
  const fc = topoToGeo(topo, topo.objects.municipalities);
  const features = fc.features.map((f) => ({
    code: normalizeCode(f.id),
    name: f.properties?.name ?? "",
    geometry: f.geometry,
  }));
  return {
    features,
    source:
      "IGN — Equipamiento Geográfico de Referencia Nacional, vía es-atlas 0.6.0 (TopoJSON simplificado, MIT)",
  };
}

/* ------------------------------------------------------------------ */
/* 2. Cargar población                                                 */
/* ------------------------------------------------------------------ */

function loadPopulation() {
  const csvPath = path.join(RAW, "poblacion.csv");
  if (existsSync(csvPath)) {
    log(`→ Población: fichero oficial ${path.relative(ROOT, csvPath)}`);
    const text = readFileSync(csvPath, "utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = lines[0].includes(";") ? ";" : ",";
    const map = new Map();
    for (const line of lines.slice(1)) {
      const parts = line.split(sep);
      if (parts.length < 3) continue;
      const code = normalizeCode(parts[0]);
      const name = parts[1].trim().replace(/^"|"$/g, "");
      const population = Number(String(parts[2]).replace(/[."\s]/g, ""));
      if (!code || !Number.isFinite(population)) continue;
      map.set(code, { name, population });
    }
    return {
      map,
      source:
        "INE — Cifras oficiales de población de los municipios (pobmun), CSV aportado en data/raw/poblacion.csv",
    };
  }

  const jsonPath = path.join(RAW, "poblacion-ine-2023.json");
  if (!existsSync(jsonPath)) {
    throw new Error(
      "No hay datos de población: coloca data/raw/poblacion.csv o data/raw/poblacion-ine-2023.json.",
    );
  }
  log(`→ Población: ${path.relative(ROOT, jsonPath)} (Padrón INE 1/1/2023)`);
  const data = JSON.parse(readFileSync(jsonPath, "utf8"));
  const map = new Map();
  for (const [code, entry] of Object.entries(data)) {
    map.set(normalizeCode(code), {
      name: entry.name,
      population: entry.population,
    });
  }
  return {
    map,
    source:
      "INE — Cifras oficiales de población de los municipios (Padrón, revisión 1/1/2023). Ver data/raw/FUENTES.md",
  };
}

/* ------------------------------------------------------------------ */
/* 3. Unión, cálculo y validación                                      */
/* ------------------------------------------------------------------ */

function main() {
  mkdirSync(OUT, { recursive: true });

  const { features: rawFeatures, source: geometrySource } = loadGeometries();
  const { map: population, source: populationSource } = loadPopulation();

  const report = {
    generatedAt: new Date().toISOString(),
    populationYear: POPULATION_YEAR,
    geometrySource,
    populationSource,
    rawGeometryCount: rawFeatures.length,
    populationRowCount: population.size,
    geometriesWithoutPopulation: [],
    populationWithoutGeometry: [],
    duplicateGeometryCodes: [],
    invalidGeometries: [],
    zeroPopulationMunicipalities: [],
    outOfRangeCoordinates: [],
  };

  const seen = new Set();
  const matchedCodes = new Set();
  const outFeatures = [];

  for (const raw of rawFeatures) {
    if (!raw.code || !raw.geometry) continue;
    if (seen.has(raw.code)) {
      report.duplicateGeometryCodes.push(raw.code);
      continue;
    }
    seen.add(raw.code);

    const pop = population.get(raw.code);
    if (!pop) {
      report.geometriesWithoutPopulation.push({ code: raw.code, name: raw.name });
      continue;
    }
    matchedCodes.add(raw.code);

    // Reducir precisión: 4 decimales ≈ 11 m, suficiente para el juego
    const truncated = truncate(
      { type: "Feature", properties: {}, geometry: raw.geometry },
      { precision: 4, coordinates: 2, mutate: true },
    );

    // Área geodésica (turf usa un algoritmo esférico; error < 0,3 % en
    // latitudes españolas, y además se cancela al usar la MISMA función
    // para numerador y denominador del prorrateo).
    const totalAreaM2 = areaFn(truncated);
    if (!Number.isFinite(totalAreaM2) || totalAreaM2 <= 0) {
      report.invalidGeometries.push({ code: raw.code, reason: "área nula" });
      continue;
    }

    const bbox = bboxFn(truncated).map((v) => Number(v.toFixed(4)));
    if (
      bbox[0] < SPAIN_BBOX[0] - 0.5 ||
      bbox[1] < SPAIN_BBOX[1] - 0.5 ||
      bbox[2] > SPAIN_BBOX[2] + 0.5 ||
      bbox[3] > SPAIN_BBOX[3] + 0.5
    ) {
      report.outOfRangeCoordinates.push({ code: raw.code, bbox });
    }

    if (pop.population === 0) {
      report.zeroPopulationMunicipalities.push(raw.code);
    }

    outFeatures.push({
      type: "Feature",
      properties: {
        municipalityCode: raw.code,
        municipalityName: pop.name || raw.name,
        provinceCode: raw.code.slice(0, 2),
        population: pop.population,
        totalAreaM2: Math.round(totalAreaM2),
        bbox,
      },
      geometry: truncated.geometry,
    });
  }

  for (const [code, entry] of population) {
    if (!matchedCodes.has(code)) {
      report.populationWithoutGeometry.push({
        code,
        name: entry.name,
        population: entry.population,
      });
    }
  }

  // Autointersecciones en las geometrías de salida (informativo)
  let selfIntersecting = 0;
  for (const f of outFeatures) {
    try {
      if (kinksFn(f).features.length > 0) selfIntersecting += 1;
    } catch {
      selfIntersecting += 1;
    }
  }
  report.selfIntersectingGeometries = selfIntersecting;

  outFeatures.sort((a, b) =>
    a.properties.municipalityCode.localeCompare(b.properties.municipalityCode),
  );

  const totalPopulation = outFeatures.reduce(
    (s, f) => s + f.properties.population,
    0,
  );
  const officialTotal = [...population.values()].reduce(
    (s, e) => s + e.population,
    0,
  );

  const collection = { type: "FeatureCollection", features: outFeatures };
  const geojsonPath = path.join(OUT, "municipalities.optimized.geojson");
  writeFileSync(geojsonPath, JSON.stringify(collection));

  const index = outFeatures.map((f) => ({
    code: f.properties.municipalityCode,
    name: f.properties.municipalityName,
    population: f.properties.population,
    totalAreaM2: f.properties.totalAreaM2,
    bbox: f.properties.bbox,
  }));
  const indexPath = path.join(OUT, "municipalities.index.json");
  writeFileSync(indexPath, JSON.stringify(index));

  const metadata = {
    populationYear: POPULATION_YEAR,
    populationSource,
    geometrySource,
    generatedAt: report.generatedAt,
    municipalityCount: outFeatures.length,
    totalPopulation,
    officialTotalPopulation: officialTotal,
    schemaVersion: SCHEMA_VERSION,
  };
  writeFileSync(path.join(OUT, "metadata.json"), JSON.stringify(metadata, null, 2));

  report.outputMunicipalityCount = outFeatures.length;
  report.totalPopulationIncluded = totalPopulation;
  report.officialTotalPopulation = officialTotal;
  report.populationCoveragePct = Number(
    ((totalPopulation / officialTotal) * 100).toFixed(3),
  );
  report.fileSizes = {
    "municipalities.optimized.geojson": statSync(geojsonPath).size,
    "municipalities.index.json": statSync(indexPath).size,
  };
  writeFileSync(
    path.join(ROOT, "data", "report.json"),
    JSON.stringify(report, null, 2),
  );

  /* Resumen en consola */
  log("");
  log("── Informe del pipeline ─────────────────────────────");
  log(`Municipios en geometrías:        ${report.rawGeometryCount}`);
  log(`Municipios en población (INE):   ${report.populationRowCount}`);
  log(`Municipios en la salida:         ${outFeatures.length}`);
  log(`Geometrías sin población:        ${report.geometriesWithoutPopulation.length}`);
  log(`Población sin geometría:         ${report.populationWithoutGeometry.length}`);
  log(`Códigos duplicados:              ${report.duplicateGeometryCodes.length}`);
  log(`Geometrías inválidas:            ${report.invalidGeometries.length}`);
  log(`Geometrías autointersectadas:    ${selfIntersecting}`);
  log(`Municipios con población 0:      ${report.zeroPopulationMunicipalities.length}`);
  log(`Coordenadas fuera de rango:      ${report.outOfRangeCoordinates.length}`);
  log(`Población total incluida:        ${totalPopulation.toLocaleString("es-ES")}`);
  log(`Población total oficial:         ${officialTotal.toLocaleString("es-ES")}`);
  log(`Cobertura de población:          ${report.populationCoveragePct} %`);
  log(
    `Tamaño geojson optimizado:       ${(report.fileSizes["municipalities.optimized.geojson"] / 1e6).toFixed(2)} MB`,
  );
  log("Informe completo: data/report.json");

  if (report.populationCoveragePct < 99) {
    log("");
    log("⚠ La cobertura de población es inferior al 99 %. Revisa los códigos sin correspondencia en data/report.json antes de publicar.");
    process.exitCode = 1;
  }
}

main();
