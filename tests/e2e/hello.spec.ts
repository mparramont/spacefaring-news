import { expect, test } from "@playwright/test";

test("subscribes to the Rust-rendered newsletter signup", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Spacefaring News");
  await expect(page.getByRole("heading", { name: "Spacefaring News" })).toBeVisible();
  await expect(page.getByText("The last frontier, the call of the void")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Board the ship" })).toBeVisible();
  await expect(page.getByText("NET: Tonight")).toBeVisible();

  await page.getByLabel("Email address").fill("reader@example.com");
  await page.getByRole("button", { name: "Subscribe" }).click();

  await expect(page.getByTestId("signup-success")).toBeVisible();
  await expect(page.getByText("You've joined the manifest.")).toBeVisible();
  await expect(page.getByText("Spacefaring News dispatch coming soon.")).toBeVisible();
});
