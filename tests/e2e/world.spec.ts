import { test, expect } from "@playwright/test";

test("world: draw a zone over Europe and get a result", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("populatio:onboarded", "1"));
  await page.goto("/?r=europe&objetivo=74000000");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("74,000,000");
  await expect(page.getByText("Loading population data…")).toHaveCount(0, { timeout: 45_000 });

  await page.waitForTimeout(300);
  await page.waitForTimeout(700);

  // Por defecto arrastrar mueve el mapa: sin pulsar Draw no hay zona.
  const map = page.getByTestId("world-map");
  const b0 = await map.boundingBox();
  if (!b0) throw new Error("The map has no size");
  await page.mouse.move(b0.x + b0.width * 0.5, b0.y + b0.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b0.x + b0.width * 0.3, b0.y + b0.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await page.getByTestId("check-button").click();
  await expect(page.getByText("Tap Draw, then drag on the map")).toBeVisible();
  await expect(page.getByTestId("result-panel")).toHaveCount(0);

  await page.getByTestId("draw-toggle").click();
  const box = await map.boundingBox();
  if (!box) throw new Error("The map has no size");
  const cx = box.x + box.width * 0.4;
  const cy = box.y + box.height * 0.55;
  const r = 45;
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  await page.mouse.up();

  await page.getByTestId("check-button").click();
  await expect(page.getByTestId("result-panel")).toBeVisible({ timeout: 30_000 });
  const estimated = await page.getByTestId("estimated-population").textContent();
  expect(Number((estimated ?? "0").replace(/,/g, ""))).toBeGreaterThan(0);
  await expect(page.getByTestId("share-button")).toBeVisible();
  await expect(page.getByTestId("post-on-x")).toBeVisible();
  // Sin red hacia x.com en los tests: se captura la URL que se abriría.
  await page.evaluate(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((url: string) => {
      (window as unknown as { __opened: string[] }).__opened.push(url);
      return null;
    }) as typeof window.open;
  });
  await page.getByTestId("post-on-x").click();
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]);
  expect(opened).toContain("x.com/intent/tweet");
  expect(decodeURIComponent(opened)).toContain("/r?d=");
  await expect(page.getByRole("button", { name: /where people live/ })).toBeVisible();
});

test("first visit shows a three-step guide once", async ({ page }) => {
  await page.goto("/?r=europe&objetivo=12000000");
  const guide = page.getByTestId("onboarding");
  await expect(guide).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Let’s play" }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("12,000,000");
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
});
