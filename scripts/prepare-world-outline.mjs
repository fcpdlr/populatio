#!/usr/bin/env node
/**
 * Genera la geometría base del mapa mundial (modo Mundo).
 *
 * Entrada: node_modules/world-atlas/countries-50m.json — TopoJSON de Natural
 * Earth 1:50m (dominio público), empaquetado por world-atlas (ISC).
 *
 * Salida: public/world/map.json con dos capas, ambas en [lng, lat]:
 *   - land:    MultiPolygon de toda la tierra emergida (unión de países)
 *   - borders: MultiLineString de las fronteras entre países
 * Coordenadas truncadas a 2 decimales (~1 km): suficiente para el fondo del
 * mapa; el cálculo de población nunca usa esta geometría.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { merge, mesh } from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ATLAS = path.join(ROOT, "node_modules", "world-atlas", "countries-50m.json");
const OUT = path.join(ROOT, "public", "world", "map.json");

const round = (n) => Math.round(n * 100) / 100;

/**
 * Redondea, elimina vértices consecutivos repetidos y "desenrolla" el
 * antimeridiano: si dos vértices seguidos saltan más de 180° de longitud
 * (Rusia, Fiyi...), se desplazan los siguientes ±360° para que la línea siga
 * continua en lugar de cruzar todo el mapa.
 */
function cleanLine(coords) {
  const out = [];
  let shift = 0;
  let prevLng = null;
  for (const [rawLng, lat] of coords) {
    if (prevLng !== null) {
      const d = rawLng - prevLng;
      if (d > 180) shift -= 360;
      else if (d < -180) shift += 360;
    }
    prevLng = rawLng;
    const p = [round(rawLng + shift), round(lat)];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  return out;
}

function main() {
  const topo = JSON.parse(readFileSync(ATLAS, "utf8"));
  const countries = topo.objects.countries;

  const land = merge(topo, countries.geometries);
  // Sin la Antártida: no tiene población y su anillo rodea el polo, lo que
  // en una proyección plana deja una línea a lo largo de todo el borde inferior.
  const landPolys = land.coordinates
    .map((poly) => poly.map(cleanLine).filter((ring) => ring.length >= 4))
    .filter((poly) => poly.length > 0)
    .filter((poly) => Math.max(...poly[0].map(([, lat]) => lat)) > -60);

  const borders = mesh(topo, countries, (a, b) => a !== b);
  const borderLines = borders.coordinates.map(cleanLine).filter((l) => l.length >= 2);

  const out = {
    source: "Natural Earth 1:50m (public domain) via world-atlas",
    land: { type: "MultiPolygon", coordinates: landPolys },
    borders: { type: "MultiLineString", coordinates: borderLines },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(OUT, json);
  process.stdout.write(
    `Mapa mundial escrito en ${path.relative(ROOT, OUT)} ` +
      `(${landPolys.length} polígonos, ${borderLines.length} fronteras, ${(json.length / 1024).toFixed(0)} KB)\n`,
  );
}

main();
