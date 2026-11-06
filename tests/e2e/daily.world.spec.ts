import { test, expect } from "@playwright/test";

test("daily: one attempt, clear score, then retry the same round in Practice", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("populatio:onboarded", "1");
    localStorage.setItem("populatio:mode", "daily");
  });
  await page.goto("/");
  await expect(page.getByText(/Daily #\d+/)).toBeVisible();
  await expect(page.getByText("Loading population data…")).toHaveCount(0, { timeout: 45_000 });
  const target = await page.getByRole("heading", { level: 1 }).innerText();

  await page.getByTestId("draw-toggle").click();
  const box = await page.getByTestId("world-map").boundingBox();
  if (!box) throw new Error("no map");
  const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.5, r = 50;
  await page.mouse.move(cx + r, cy);
  await page.mouse.down();
  for (let i = 1; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  await page.mouse.up();
  await page.getByTestId("check-button").click();
  await page.getByTestId("daily-confirm-button").click();
  await expect(page.getByTestId("result-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("score-label")).not.toHaveText("");

  await page.getByTestId("practice-same").click();
  await expect(page.getByRole("tab", { name: "Practice" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(target);
  await expect(page.getByTestId("hint-toggle")).toBeVisible();
});
