#!/usr/bin/env node
/**
 * Genera las etiquetas del mapa mundial (países y ciudades).
 *
 * Fuente: Natural Earth (dominio público), repositorio nvkelso/natural-earth-vector:
 *   - ne_50m_admin_0_countries: punto de etiqueta (LABEL_X/Y) y zoom mínimo/máximo
 *   - ne_10m_populated_places_simple: ciudades con población y zoom mínimo
 *
 * Uso: node scripts/prepare-world-labels.mjs [carpeta-con-los-geojson]
 * Sin carpeta, descarga los dos ficheros de GitHub.
 *
 * Salida: public/world/labels.json
 *   countries: [nombre, lng, lat, zoomMin, zoomMax, rango]
 *   cities:    [nombre, lng, lat, zoomMin, población]
 * Los zooms siguen la escala habitual de mapas web (0 = mundo en 256 px).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "world", "labels.json");
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const MIN_CITY_POP = 300_000;

async function load(name, dir) {
  const local = dir && path.join(dir, `${name}.geojson`);
  if (local && existsSync(local)) return JSON.parse(readFileSync(local, "utf8"));
  const res = await fetch(BASE + name + ".geojson");
  if (!res.ok) throw new Error(`No se ha podido descargar ${name}: ${res.status}`);
  return res.json();
}

const r2 = (n) => Math.round(n * 100) / 100;

async function main() {
  const dir = process.argv[2];
  const countries = (await load("ne_50m_admin_0_countries", dir)).features
    .map((f) => f.properties)
    // Sin microestados (Vaticano, Mónaco...): saturan el mapa y no ayudan a orientarse.
    .filter((p) => p.LABEL_X != null && p.MIN_LABEL != null && p.MIN_LABEL <= 6 && (p.POP_EST ?? 0) >= 250_000)
    .map((p) => [p.NAME_EN || p.NAME, r2(p.LABEL_X), r2(p.LABEL_Y), p.MIN_LABEL, p.MAX_LABEL ?? 10, p.LABELRANK ?? 5])
    .sort((a, b) => a[5] - b[5] || a[3] - b[3]);

  const cities = (await load("ne_10m_populated_places_simple", dir)).features
    .map((f) => f.properties)
    .filter((p) => p.pop_max >= MIN_CITY_POP || p.adm0cap === 1)
    .map((p) => [p.name, r2(p.longitude), r2(p.latitude), p.min_zoom, p.pop_max])
    .sort((a, b) => b[4] - a[4]);

  const out = {
    source: "Natural Earth (public domain)",
    countries,
    cities,
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(OUT, json);
  process.stdout.write(
    `Etiquetas escritas en ${path.relative(ROOT, OUT)}: ${countries.length} países, ${cities.length} ciudades (${(json.length / 1024).toFixed(0)} KB)\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
