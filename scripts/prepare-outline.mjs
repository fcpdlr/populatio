#!/usr/bin/env node
/**
 * Genera el contorno de España para el mapa en <canvas>.
 *
 * Entrada: node_modules/es-atlas/es/autonomous_regions.json — TopoJSON del
 * proyecto es-atlas (IGN, MIT), el mismo respaldo que usa
 * prepare-municipal-data.mjs. Se usa el objeto `border` (unión de todo el
 * territorio: península, Baleares, Canarias, Ceuta y Melilla), que pesa muy
 * poco comparado con las geometrías municipales.
 *
 * Salida: public/data/spain-outline.geojson — un único Feature MultiPolygon,
 * sin ninguna dependencia en tiempo de ejecución (el cliente solo hace un
 * fetch a un fichero estático).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { feature as topoToGeo } from "topojson-client";
import truncate from "@turf/truncate";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ATLAS = path.join(
  ROOT,
  "node_modules",
  "es-atlas",
  "es",
  "autonomous_regions.json",
);
const OUT = path.join(ROOT, "public", "data", "spain-outline.geojson");

function main() {
  const topo = JSON.parse(readFileSync(ATLAS, "utf8"));
  const fc = topoToGeo(topo, topo.objects.border);
  const [borderFeature] = fc.features;

  const truncated = truncate(borderFeature, {
    precision: 4,
    coordinates: 2,
    mutate: true,
  });
  truncated.properties = { name: "España" };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(truncated));

  const polygonCount = truncated.geometry.coordinates.length;
  const sizeKb = (JSON.stringify(truncated).length / 1024).toFixed(1);
  process.stdout.write(
    `Contorno escrito en ${path.relative(ROOT, OUT)} (${polygonCount} polígonos, ${sizeKb} KB)\n`,
  );
}

main();
