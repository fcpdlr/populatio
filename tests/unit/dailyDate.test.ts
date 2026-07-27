import { describe, it, expect } from "vitest";
import {
  todayInMadrid,
  addDaysToDateString,
  previousDateString,
  msUntilNextMadridMidnight,
  challengeNumberForDate,
  DAILY_LAUNCH_DATE,
} from "@/lib/game/dailyDate";

describe("todayInMadrid", () => {
  it("usa la fecha de Madrid, no la de UTC, cuando difieren (verano, UTC+2)", () => {
    // 22:30 UTC de 15 jun = 00:30 en Madrid (CEST) del 16
    expect(todayInMadrid(new Date("2026-06-15T22:30:00Z"))).toBe("2026-06-16");
  });

  it("usa la fecha de Madrid, no la de UTC, cuando difieren (invierno, UTC+1)", () => {
    // 23:30 UTC de 15 ene = 00:30 en Madrid (CET) del 16
    expect(todayInMadrid(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("coincide con la fecha UTC cuando la hora local en Madrid no ha cruzado medianoche", () => {
    expect(todayInMadrid(new Date("2026-06-15T10:00:00Z"))).toBe("2026-06-15");
  });
});

describe("addDaysToDateString / previousDateString", () => {
  it("cruza el fin de mes", () => {
    expect(addDaysToDateString("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("cruza el fin de febrero en año no bisiesto", () => {
    expect(previousDateString("2026-03-01")).toBe("2026-02-28");
  });

  it("admite saltos negativos arbitrarios", () => {
    expect(addDaysToDateString("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("msUntilNextMadridMidnight", () => {
  it("calcula el tiempo restante hasta medianoche en Madrid (verano)", () => {
    // Medianoche del 16 jun en Madrid (CEST, UTC+2) = 2026-06-15T22:00:00Z
    const now = new Date("2026-06-15T21:59:00Z");
    expect(msUntilNextMadridMidnight(now)).toBe(60_000);
  });

  it("nunca es negativo", () => {
    expect(msUntilNextMadridMidnight(new Date("2026-06-15T21:59:59.999Z"))).toBeGreaterThanOrEqual(0);
  });
});

describe("challengeNumberForDate", () => {
  it("el reto #1 cae en la fecha de lanzamiento", () => {
    expect(challengeNumberForDate(DAILY_LAUNCH_DATE)).toBe(1);
  });

  it("aumenta un número por cada día transcurrido", () => {
    const in141Days = addDaysToDateString(DAILY_LAUNCH_DATE, 141);
    expect(challengeNumberForDate(in141Days)).toBe(142);
  });
});
