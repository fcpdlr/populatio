import { test, expect } from "@playwright/test";

test("guess: a zone appears, a guess is scored", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("populatio:mode", "guess"));
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Guess" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("guess-submit")).toBeEnabled({ timeout: 45_000 });
  await page.getByTestId("guess-submit").click();
  await expect(page.getByTestId("guess-result")).toContainText("Actual");
  await page.getByRole("button", { name: "Next zone" }).click();
  await expect(page.getByText(/Round 2\/5/)).toBeVisible();
});

test("more or less: picking a zone reveals both populations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("populatio:mode", "duel"));
  await page.goto("/");
  await expect(page.getByTestId("duel-a")).toBeEnabled({ timeout: 45_000 });
  await expect(page.getByTestId("duel-a-area")).toContainText("km²");
  await expect(page.getByTestId("duel-b-area")).toContainText("km²");
  await page.getByTestId("duel-a").click();
  await expect(page.getByTestId("duel-result")).toContainText(/Right|Wrong/);
  await expect(page.getByTestId("duel-a")).toContainText(/\d/);
  await expect(page.getByTestId("duel-b")).toContainText(/\d/);
});

test("practice: a shared round link opens that target, without naming the region", async ({ page }) => {
  await page.goto("/?r=europe&objetivo=12000000");
  await expect(page.getByText(/Europe/)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("12,000,000");
});
