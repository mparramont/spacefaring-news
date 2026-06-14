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

test("shows source catalog with latest item data", async ({ page }) => {
  await page.route("https://spacefaring-news-ingest.mparramont.workers.dev/sources", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "nasa-news-releases",
          title: "NASA News Releases",
          url: "https://www.nasa.gov/news-release/feed/",
          homepage: "https://www.nasa.gov/news-release/",
          category: "agency",
          language: "en",
          region: "us",
          enabled: 1,
          updated_at: "2026-06-14T10:00:00.000Z",
          latest_item_id: "item-1",
          latest_item_title: "Artemis update",
          latest_item_url: "https://example.com/artemis",
          latest_item_published_at: "2026-06-14T09:00:00.000Z",
          latest_item_fetched_at: "2026-06-14T10:00:00.000Z",
        },
        {
          id: "x-isro",
          title: "ISRO on X",
          url: "https://x.com/isro",
          homepage: "https://www.isro.gov.in/",
          category: "agency",
          language: "en",
          region: "india",
          enabled: 1,
          updated_at: "2026-06-14T10:00:00.000Z",
          latest_item_id: "x:200",
          latest_item_title: "Mission Drishti has launched successfully.",
          latest_item_url: "https://x.com/isro/status/200",
          latest_item_published_at: "2026-06-14T01:30:00.000Z",
          latest_item_fetched_at: "2026-06-14T03:00:00.000Z",
        },
      ]),
    });
  });

  await page.goto("/sources.html");

  await expect(page).toHaveTitle("Sources - Spacefaring News");
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(page.getByText("2 of 2 active sources")).toBeVisible();
  await expect(page.getByRole("link", { name: "NASA News Releases" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Artemis update" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mission Drishti has launched successfully." })).toBeVisible();

  await page.getByLabel("Search").fill("india");

  await expect(page.getByText("1 of 2 active sources")).toBeVisible();
  await expect(page.getByRole("link", { name: "ISRO on X" })).toBeVisible();
  await expect(page.getByRole("link", { name: "NASA News Releases" })).toHaveCount(0);
});
