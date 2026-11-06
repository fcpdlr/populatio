import { describe, it, expect } from "vitest";
import { scoreBar, roundSquares, signedPercent, drawShareText } from "@/lib/share";

describe("share", () => {
  it("scoreBar tiene siempre cinco cuadros", () => {
    expect(scoreBar(0)).toBe("⬜⬜⬜⬜⬜");
    expect(scoreBar(1000)).toBe("🟩🟩🟩🟩🟩");
    expect([...scoreBar(415)].length).toBe(5);
  });
  it("roundSquares colorea por puntuación", () => {
    expect(roundSquares([900, 500, 100])).toBe("🟩🟨⬜");
  });
  it("signedPercent indica si te pasas o te quedas corto", () => {
    expect(signedPercent(110, 100)).toBe("+10.0%");
    expect(signedPercent(90, 100)).toBe("−10.0%");
  });
  it("el texto incluye objetivo, resultado y enlace", () => {
    const t = drawShareText({ label: "Daily #310", target: 89_000_000, estimated: 81_200_000, score: 415, url: "https://populat.io" });
    expect(t).toContain("Daily #310");
    expect(t).toContain("89,000,000");
    expect(t).toContain("−8.8%");
    expect(t).toContain("415/1000");
    expect(t).toContain("https://populat.io");
  });
});
