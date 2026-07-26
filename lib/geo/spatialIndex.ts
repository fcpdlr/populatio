export type BBox = [number, number, number, number];

export type IndexedItem<T> = { bbox: BBox; item: T };

/**
 * Índice espacial mínimo por bounding boxes.
 *
 * Con ~8.100 municipios, una pasada lineal comparando bboxes cuesta
 * décimas de milisegundo, así que el MVP no necesita un R-tree.
 * La interfaz está aislada para poder sustituirla (p. ej. flatbush)
 * sin tocar el estimador.
 */
export class BBoxIndex<T> {
  private items: IndexedItem<T>[] = [];

  constructor(items: IndexedItem<T>[] = []) {
    this.items = items;
  }

  add(bbox: BBox, item: T): void {
    this.items.push({ bbox, item });
  }

  /** Devuelve los elementos cuyo bbox se solapa con el consultado. */
  search(query: BBox): T[] {
    const [qMinX, qMinY, qMaxX, qMaxY] = query;
    const out: T[] = [];
    for (const { bbox, item } of this.items) {
      const [minX, minY, maxX, maxY] = bbox;
      if (minX <= qMaxX && maxX >= qMinX && minY <= qMaxY && maxY >= qMinY) {
        out.push(item);
      }
    }
    return out;
  }

  get size(): number {
    return this.items.length;
  }
}

export function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
