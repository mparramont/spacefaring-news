import assert from "node:assert/strict";
import test from "node:test";
import { ingestFeeds } from "../../ingest/ingest";
import { NEWS_SOURCE_COUNT, NEWS_SOURCES } from "../../ingest/sources";
import type { FeedSource, IngestionRun, NewsItem, NewsStore } from "../../ingest/types";

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

test("source catalog stays within the requested 50-100 source range", () => {
  assert.equal(NEWS_SOURCE_COUNT, NEWS_SOURCES.length);
  assert.ok(NEWS_SOURCE_COUNT >= 50, `expected at least 50 sources, got ${NEWS_SOURCE_COUNT}`);
  assert.ok(NEWS_SOURCE_COUNT <= 100, `expected at most 100 sources, got ${NEWS_SOURCE_COUNT}`);
});

test("ingests multiple feeds, stores normalized items, and records failures", async () => {
  const store = new MemoryNewsStore();
  const sources: FeedSource[] = [
    {
      id: "rss-source",
      title: "RSS Source",
      url: "https://example.com/rss.xml",
      homepage: "https://example.com/",
      category: "launch",
      language: "en",
      region: "global",
      cadenceMinutes: 30,
    },
    {
      id: "atom-source",
      title: "Atom Source",
      url: "https://example.com/atom.xml",
      homepage: "https://example.com/",
      category: "agency",
      language: "en",
      region: "global",
      cadenceMinutes: 30,
    },
    {
      id: "bad-source",
      title: "Bad Source",
      url: "https://example.com/bad.xml",
      homepage: "https://example.com/",
      category: "policy",
      language: "en",
      region: "global",
      cadenceMinutes: 30,
    },
  ];

  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);

    if (url.endsWith("bad.xml")) {
      return new Response("nope", { status: 503 });
    }

    if (url.endsWith("atom.xml")) {
      return new Response(`
        <feed>
          <entry>
            <title>Policy update</title>
            <id>policy-1</id>
            <link rel="alternate" href="https://example.com/policy" />
            <updated>2026-06-14T01:00:00Z</updated>
          </entry>
        </feed>`);
    }

    return new Response(`
      <rss>
        <channel>
          <item>
            <title>Launch update</title>
            <link>https://example.com/launch</link>
            <guid>launch-1</guid>
            <pubDate>Sun, 14 Jun 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`);
  };

  const run = await ingestFeeds(store, {
    fetcher: fetcher as typeof fetch,
    sources,
    now: new Date("2026-06-14T02:00:00Z"),
  });

  assert.equal(store.sources.length, 3);
  assert.equal(store.items.length, 2);
  assert.deepEqual(
    store.items.map((item) => item.title).sort(),
    ["Launch update", "Policy update"],
  );
  assert.equal(run.sourceCount, 3);
  assert.equal(run.fetchedCount, 2);
  assert.equal(run.storedCount, 2);
  assert.equal(run.failedCount, 1);
  assert.equal(run.errors[0].sourceId, "bad-source");
  assert.equal(store.runs.length, 1);
});
