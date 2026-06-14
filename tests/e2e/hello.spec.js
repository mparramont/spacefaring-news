import { expect, test } from "@playwright/test";

async function expectThemeLoaded(page, selector) {
  const styles = await page.locator(selector).evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      borderBottomWidth: computed.borderBottomWidth,
      color: computed.color,
      fontFamily: computed.fontFamily,
      marginBottom: computed.marginBottom,
    };
  });

  expect(styles.fontFamily).toContain("Segoe UI");
  expect(styles.color).toBe("rgb(17, 17, 17)");
  expect(styles.borderBottomWidth).toBe("1px");
  expect(styles.marginBottom).not.toBe("0px");

  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.length).toBeGreaterThan(10_000);
}

test("subscribes to the Rust-rendered newsletter signup", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Spacefaring News");
  await expectThemeLoaded(page, "header.site");
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
  await page.route("https://spacefaring-news-ingest.mparramont.workers.dev/sources-fragment**", async (route) => {
    const url = new URL(route.request().url());
    const isIndiaFilter = url.searchParams.get("q") === "india";
    await route.fulfill({
      contentType: "text/html",
      body: isIndiaFilter
        ? `
          <section id="source-summary" class="source-summary" aria-live="polite">1 of 2 active sources</section>
          <section id="source-list" class="source-list" aria-live="polite">
            <article class="source-card">
              <h2><a href="https://www.isro.gov.in/">ISRO on X</a></h2>
              <p class="source-latest">Latest: <a href="https://x.com/isro/status/200">Mission Drishti has launched successfully.</a> (2026-06-14)</p>
            </article>
          </section>`
        : `
          <section id="source-summary" class="source-summary" aria-live="polite">2 of 2 active sources</section>
          <section id="source-list" class="source-list" aria-live="polite">
            <article class="source-card">
              <h2><a href="https://www.nasa.gov/news-release/">NASA News Releases</a></h2>
              <p class="source-latest">Latest: <a href="https://example.com/artemis">Artemis update</a> (2026-06-14)</p>
            </article>
            <article class="source-card">
              <h2><a href="https://www.isro.gov.in/">ISRO on X</a></h2>
              <p class="source-latest">Latest: <a href="https://x.com/isro/status/200">Mission Drishti has launched successfully.</a> (2026-06-14)</p>
            </article>
          </section>`,
    });
  });

  await page.goto("/sources.html");

  await expect(page).toHaveTitle("Sources - Spacefaring News");
  await expectThemeLoaded(page, "header.site");
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
