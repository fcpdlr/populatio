import { test, expect } from "@playwright/test";

test("world: draw a zone over Europe and get a result", async ({ page }) => {
  await page.goto("/?r=europe&objetivo=74000000");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("74,000,000");
  await expect(page.getByText("Loading population data…")).toHaveCount(0, { timeout: 45_000 });

  await page.waitForTimeout(300);
  await page.waitForTimeout(700);

  const map = page.getByTestId("world-map");
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
});
