import { test, expect } from "@playwright/test";

/**
 * Partida básica: cargar el juego, dibujar un polígono sobre la península,
 * comprobar y ver el resultado. Requiere red (mapa base y datos locales).
 */
test("una partida básica: dibujar, comprobar y ver resultado", async ({
  page,
}) => {
  // Objetivo fijo en la URL para que la partida sea reproducible
  await page.goto("/?objetivo=10000000");

  // El objetivo aparece formateado en español
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "10.000.000",
    { timeout: 20_000 },
  );

  // Espera a que mapa y datos estén listos (botón habilitado)
  const check = page.getByTestId("check-button");
  await expect(check).toBeEnabled({ timeout: 60_000 });

  // Dibuja un triángulo grande sobre el centro peninsular arrastrando el
  // ratón (a mano alzada); se cierra solo al soltar.
  const map = page.getByTestId("spain-map");
  const box = await map.boundingBox();
  if (!box) throw new Error("El mapa no tiene dimensiones");

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 80, cy - 60);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy - 60, { steps: 10 });
  await page.mouse.move(cx, cy + 80, { steps: 10 });
  await page.mouse.move(cx - 80, cy - 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  // Comprueba
  await check.click();

  // Aparece el panel de resultado con estimación y puntuación
  const panel = page.getByTestId("result-panel");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("estimated-population")).not.toHaveText("");
  await expect(page.getByTestId("score")).not.toHaveText("");

  // Puede reintentar: el panel desaparece y vuelve el botón Comprobar
  await page.getByRole("button", { name: "Intentar de nuevo" }).click();
  await expect(check).toBeVisible({ timeout: 10_000 });
});
