import { test, expect } from "@playwright/test";

async function drawTriangle(page: import("@playwright/test").Page) {
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
}

/**
 * Modo Diario: sin ?objetivo= en la URL, un enlace directo abre en Diario.
 * Un único intento: dibujar exige confirmar antes de calcular, y tras
 * confirmar el resultado queda bloqueado (sin reintentos) incluso recargando
 * la página.
 */
test("modo Diario: confirmación de intento único y bloqueo persistente", async ({
  page,
}) => {
  await page.goto("/");

  // Arranca en Diario, con el número de reto visible
  await expect(page.getByRole("tab", { name: "Diario" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("text=/Reto diario #\\d+/")).toBeVisible({
    timeout: 20_000,
  });

  const check = page.getByTestId("check-button");
  await expect(check).toBeEnabled({ timeout: 60_000 });

  await drawTriangle(page);
  await check.click();

  // Comprobar abre la confirmación en vez de calcular directamente
  const confirmSheet = page.getByTestId("daily-confirm-sheet");
  await expect(confirmSheet).toBeVisible({ timeout: 5_000 });

  // "Seguir ajustando" descarta la confirmación sin bloquear nada
  await page.getByRole("button", { name: "Seguir ajustando" }).click();
  await expect(confirmSheet).toBeHidden();
  await expect(check).toBeVisible();

  // Confirmar calcula y bloquea
  await check.click();
  await expect(confirmSheet).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("daily-confirm-button").click();

  const panel = page.getByTestId("result-panel");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  const score = await page.getByTestId("score").textContent();

  // No hay reintentos en Diario; en su lugar, cuenta atrás al próximo reto
  await expect(page.getByRole("button", { name: "Intentar de nuevo" })).toHaveCount(0);
  await expect(page.getByTestId("daily-countdown")).toBeVisible();

  // Reabrir el mismo día muestra el resultado guardado directamente
  await page.reload();
  await expect(page.getByTestId("result-panel")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("check-button")).toHaveCount(0);
  await expect(page.getByTestId("score")).toHaveText(score ?? "");
});

test("modo Práctica sigue permitiendo intentos ilimitados sin confirmación", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Práctica" }).click();

  const check = page.getByTestId("check-button");
  await expect(check).toBeEnabled({ timeout: 60_000 });

  await drawTriangle(page);
  await check.click();

  // Sin hoja de confirmación en Práctica
  await expect(page.getByTestId("daily-confirm-sheet")).toHaveCount(0);
  await expect(page.getByTestId("result-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Intentar de nuevo" }).click();
  await expect(check).toBeVisible({ timeout: 10_000 });
});
