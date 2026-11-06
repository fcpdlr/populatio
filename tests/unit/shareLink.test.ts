import { describe, it, expect } from "vitest";
import { encodePayload, decodePayload, packSilhouette, shareUrl, xIntentUrl } from "@/lib/shareLink";
import { summarize } from "@/lib/shareSummary";

const square = {
  type: "Polygon" as const,
  coordinates: [[[0, 40], [2, 40], [2, 41], [0, 41], [0, 40]]],
};

describe("shareLink", () => {
  it("ida y vuelta de un resultado de Daily con silueta", () => {
    const sil = packSilhouette(square)!;
    const p = { m: "d" as const, n: 310, t: 89_000_000, e: 81_200_000, s: 415, g: sil.g, a: sil.a };
    const back = decodePayload(encodePayload(p));
    expect(back).toEqual(p);
    expect(summarize(back!).headline).toBe("415 / 1000");
  });

  it("rechaza datos manipulados o rotos", () => {
    expect(decodePayload("no-es-base64!!")).toBeNull();
    expect(decodePayload(encodePayload({ m: "d", t: 1, e: 1, s: 5000 } as never))).toBeNull();
    expect(decodePayload(encodePayload({ m: "p", t: 1, e: 1, s: 1, r: "<script>" } as never))).toBeNull();
  });

  it("Guess y More or Less", () => {
    expect(decodePayload(encodePayload({ m: "g", s: 3412, q: "9,5,1,7,8" }))).toEqual({ m: "g", s: 3412, q: "9,5,1,7,8" });
    expect(decodePayload(encodePayload({ m: "l", k: 7 }))).toEqual({ m: "l", k: 7 });
  });

  it("el enlace es corto y apto para X", () => {
    const sil = packSilhouette(square)!;
    const url = shareUrl("https://populat.io", { m: "p", t: 12_000_000, e: 11_000_000, s: 900, r: "europe", ...sil });
    expect(url.length).toBeLessThan(400);
    expect(xIntentUrl("hola\nmundo")).toBe("https://x.com/intent/tweet?text=hola%0Amundo");
  });
});
