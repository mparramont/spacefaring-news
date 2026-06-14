import { expect, test } from "@playwright/test";

test("loads the htmx briefing rendered by the Rust backend", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Spacefaring News");
  await expect(page.getByRole("heading", { name: "Spacefaring News" })).toBeVisible();
  await expect(page.getByText("@spacefaringnews")).toBeVisible();

  await page.getByRole("button", { name: "Load briefing" }).click();

  await expect(page.getByTestId("hello-brief")).toBeVisible();
  await expect(page.getByText("Hello from Spacefaring News")).toBeVisible();
  await expect(page.getByText("Rust rendered this briefing fragment")).toBeVisible();
});

