import assert from "node:assert/strict";
import { test } from "node:test";

import { rankDailyStories } from "../ingest/ranking.js";

const now = new Date("2026-06-15T08:00:00.000Z");

test("clusters similar top stories and ranks impact signals first", () => {
  const run = rankDailyStories(
    [
      item({
        id: "nasa-1",
        source_id: "nasa",
        source_title: "NASA News Releases",
        title: "NASA awards Artemis lunar lander contract",
        region: "us",
        language: "en",
      }),
      item({
        id: "space-news-1",
        source_id: "spacenews",
        source_title: "SpaceNews",
        title: "NASA awards Artemis lunar lander contract",
        region: "us",
        language: "en",
      }),
      item({
        id: "isro-1",
        source_id: "isro",
        source_title: "ISRO",
        title: "ISRO launches new satellite mission",
        region: "india",
        language: "en",
      }),
      item({
        id: "science-1",
        source_id: "science",
        source_title: "Science Desk",
        title: "Astronomers publish telescope image gallery",
        region: "global",
        language: "en",
        published_at: "2026-06-10T08:00:00.000Z",
      }),
    ],
    { now, runDate: "2026-06-15" },
  );

  assert.equal(run.method, "deterministic-v1");
  assert.equal(run.item_count, 4);
  assert.equal(run.cluster_count, 3);

  const nasa = run.clusters.find((cluster) => cluster.representative_title === "NASA awards Artemis lunar lander contract");
  assert.equal(nasa.source_count, 2);
  assert.deepEqual(nasa.item_ids.sort(), ["nasa-1", "space-news-1"]);
  assert(nasa.importance_score > 0.4);
  assert(nasa.score_reasons.some((reason) => reason.includes("impact terms")));

  const isro = run.clusters.find((cluster) => cluster.representative_title === "ISRO launches new satellite mission");
  assert(isro.score_reasons.includes("non-western source signal"));
  assert(isro.score_reasons.includes("official or primary source signal"));
});

function item(overrides) {
  return {
    id: "item",
    source_id: "source",
    source_title: "Source",
    title: "Story",
    url: "https://example.com/story",
    summary: null,
    published_at: "2026-06-15T07:00:00.000Z",
    fetched_at: "2026-06-15T07:30:00.000Z",
    category: "agency",
    language: "en",
    region: "global",
    ...overrides,
  };
}
