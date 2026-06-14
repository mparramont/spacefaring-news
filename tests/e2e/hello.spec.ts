import { expect, test } from "@playwright/test";

test("subscribes and previews the Rust-rendered newsletter fragment", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Spacefaring News");
  await expect(page.getByRole("heading", { name: "Spacefaring News" })).toBeVisible();
  await expect(page.getByText("@spacefaringnews")).toBeVisible();

  await page.getByLabel("Email address").fill("reader@example.com");
  await page.getByRole("button", { name: "Subscribe" }).click();

  await expect(page.getByTestId("signup-success")).toBeVisible();
  await expect(page.getByText("You are on the list.")).toBeVisible();

  await page.getByRole("button", { name: "Preview latest" }).click();

  await expect(page.getByTestId("latest-issue")).toBeVisible();
  await expect(page.getByText("Latest issue")).toBeVisible();
  await expect(page.getByText("spacefaring economy")).toBeVisible();
});
