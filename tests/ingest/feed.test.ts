import assert from "node:assert/strict";
import test from "node:test";
import { parseFeed } from "../../ingest/feed";
import type { FeedSource } from "../../ingest/types";

const source: FeedSource = {
  id: "test-source",
  title: "Test Source",
  url: "https://example.com/feed.xml",
  homepage: "https://example.com/",
  category: "industry",
  language: "en",
  region: "global",
  cadenceMinutes: 30,
};

test("parses RSS items into normalized news items", () => {
  const items = parseFeed(
    `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <item>
          <title>Launch window opens</title>
          <link>https://example.com/launch</link>
          <guid>launch-1</guid>
          <pubDate>Sat, 13 Jun 2026 12:00:00 GMT</pubDate>
          <description><![CDATA[<p>Vehicle is vertical.</p>]]></description>
          <dc:creator>Mission Desk</dc:creator>
        </item>
      </channel>
    </rss>`,
    source,
    "2026-06-14T00:00:00.000Z",
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, "test-source");
  assert.equal(items[0].title, "Launch window opens");
  assert.equal(items[0].url, "https://example.com/launch");
  assert.equal(items[0].summary, "Vehicle is vertical.");
  assert.equal(items[0].author, "Mission Desk");
  assert.equal(items[0].publishedAt, "2026-06-13T12:00:00.000Z");
});

test("parses Atom entries with alternate links", () => {
  const items = parseFeed(
    `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Station crew update</title>
        <id>tag:example.com,2026:station</id>
        <link rel="alternate" href="https://example.com/station" />
        <updated>2026-06-14T01:30:00Z</updated>
        <summary>Docking complete.</summary>
        <author><name>Orbit Desk</name></author>
      </entry>
    </feed>`,
    source,
    "2026-06-14T02:00:00.000Z",
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Station crew update");
  assert.equal(items[0].url, "https://example.com/station");
  assert.equal(items[0].summary, "Docking complete.");
  assert.equal(items[0].author, "Orbit Desk");
  assert.equal(items[0].publishedAt, "2026-06-14T01:30:00.000Z");
});
