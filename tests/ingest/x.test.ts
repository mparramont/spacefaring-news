import assert from "node:assert/strict";
import test from "node:test";
import { ingestXPosts } from "../../ingest/x";
import { X_SOURCE_COUNT, X_SOURCES } from "../../ingest/x-sources";
import type { FeedSource, IngestionRun, NewsItem, NewsStore, XSource } from "../../ingest/types";

class MemoryNewsStore implements NewsStore {
  sources: FeedSource[] = [];
  items: NewsItem[] = [];
  runs: IngestionRun[] = [];

  async saveSources(sources: FeedSource[]) {
    this.sources = sources;
  }

  async saveItems(items: NewsItem[]) {
    const existing = new Set(this.items.map((item) => item.id));
    const fresh = items.filter((item) => !existing.has(item.id));
    this.items.push(...fresh);
    return fresh.length;
  }

  async recordRun(run: IngestionRun) {
    this.runs.push(run);
  }
}

test("X source catalog stays intentionally small", () => {
  assert.equal(X_SOURCE_COUNT, X_SOURCES.length);
  assert.ok(X_SOURCE_COUNT >= 10, `expected at least 10 X sources, got ${X_SOURCE_COUNT}`);
  assert.ok(X_SOURCE_COUNT <= 50, `expected at most 50 X sources, got ${X_SOURCE_COUNT}`);
});

test("ingests X posts into normalized news items", async () => {
  const store = new MemoryNewsStore();
  const sources: XSource[] = [
    {
      id: "x-isro",
      title: "ISRO on X",
      username: "isro",
      url: "https://x.com/isro",
      homepage: "https://www.isro.gov.in/",
      category: "agency",
      language: "en",
      region: "india",
      cadenceMinutes: 1440,
    },
  ];

  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input));

    if (url.pathname === "/2/users/by") {
      assert.equal(url.searchParams.get("usernames"), "isro");
      return Response.json({
        data: [{ id: "123", username: "isro", name: "ISRO" }],
      });
    }

    if (url.pathname === "/2/users/123/tweets") {
      assert.equal(url.searchParams.get("exclude"), "retweets,replies");
      assert.equal(url.searchParams.get("max_results"), "5");
      assert.ok(url.searchParams.get("start_time")?.startsWith("2026-06-12"));
      return Response.json({
        data: [
          {
            id: "200",
            text: "Mission Drishti has launched successfully.",
            created_at: "2026-06-14T01:30:00Z",
            lang: "en",
            public_metrics: { like_count: 12, retweet_count: 3 },
          },
        ],
      });
    }

    return new Response("not found", { status: 404 });
  };

  const run = await ingestXPosts(store, {
    bearerToken: "test-token",
    fetcher: fetcher as typeof fetch,
    sources,
    now: new Date("2026-06-14T03:00:00Z"),
    maxPostsPerSource: 3,
    lookbackHours: 36,
  });

  assert.equal(store.sources.length, 1);
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].id, "x:200");
  assert.equal(store.items[0].sourceId, "x-isro");
  assert.equal(store.items[0].url, "https://x.com/isro/status/200");
  assert.equal(store.items[0].summary, "Mission Drishti has launched successfully.");
  assert.equal(store.items[0].publishedAt, "2026-06-14T01:30:00.000Z");
  assert.deepEqual(store.items[0].raw.public_metrics, { like_count: 12, retweet_count: 3 });
  assert.equal(run.fetchedCount, 1);
  assert.equal(run.storedCount, 1);
  assert.equal(run.failedCount, 0);
});
