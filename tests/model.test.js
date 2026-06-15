import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultWeights, scoreClusterWithModel, trainEditorialModel, trainingExamplesFromClusters } from "../ingest/model.js";

const now = new Date("2026-06-15T08:00:00.000Z");

test("builds SpaceNews seed examples and trains a usable scorer", () => {
  const clusters = [
    cluster({
      representative_title: "SpaceNews reports major launch contract",
      has_spacenews: true,
      source_titles: "SpaceNews",
      importance_score: 0.62,
    }),
    cluster({
      representative_title: "Low priority archive photo gallery",
      importance_score: 0.2,
    }),
  ];
  const examples = trainingExamplesFromClusters(clusters);

  assert.equal(examples.some((example) => example.source === "spacenews_seed" && example.label === 1), true);
  assert.equal(examples.some((example) => example.source === "low_score_seed" && example.label === 0.2), true);

  const modelRun = trainEditorialModel(examples, { now, initialWeights: defaultWeights() });
  assert.equal(modelRun.model_name, "editorial-logistic-v1");
  assert.equal(modelRun.example_count, 2);
  assert.equal(modelRun.seed_positive_count, 1);
  assert(modelRun.weights.has_spacenews > 0);

  const spacenewsScore = scoreClusterWithModel(clusters[0], modelRun.weights);
  const lowScore = scoreClusterWithModel(clusters[1], modelRun.weights);
  assert(spacenewsScore > lowScore);
});

function cluster(overrides) {
  return {
    representative_title: "Story",
    summary: null,
    source_count: 1,
    region_count: 1,
    language_count: 1,
    importance_score: 0.5,
    score_reasons: ["1 source"],
    status: "needs_review",
    has_spacenews: false,
    source_titles: "Source",
    primary_region: "global",
    ...overrides,
  };
}
