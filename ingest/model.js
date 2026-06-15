const MODEL_NAME = "editorial-logistic-v1";
const LEARNING_RATE = 0.08;
const EPOCHS = 80;
const L2 = 0.001;

const FEATURE_NAMES = [
  "bias",
  "deterministic_score",
  "source_count",
  "region_count",
  "language_count",
  "has_spacenews",
  "has_official_source",
  "has_non_western_source",
  "has_launch_term",
  "has_policy_term",
  "has_contract_term",
  "has_human_spaceflight_term",
  "is_recent",
];

const TOPIC_TERMS = {
  has_launch_term: ["launch", "rocket", "liftoff", "mission"],
  has_policy_term: ["policy", "regulation", "budget", "defense", "space force"],
  has_contract_term: ["contract", "funding", "award", "ipo", "acquisition"],
  has_human_spaceflight_term: ["crew", "astronaut", "station", "artemis", "moon"],
};

const NON_WESTERN_REGIONS = new Set(["africa", "brazil", "china", "india", "israel", "japan", "latam", "mena", "russia"]);

export { MODEL_NAME };

export function defaultWeights() {
  return Object.fromEntries(FEATURE_NAMES.map((feature) => [feature, 0]));
}

export function featureNames() {
  return FEATURE_NAMES;
}

export function scoreClusterWithModel(cluster, weights = defaultWeights()) {
  const features = modelFeatures(cluster);
  return sigmoid(dot(features, weights));
}

export function trainEditorialModel(examples, options = {}) {
  const now = options.now ?? new Date();
  const weights = { ...defaultWeights(), ...(options.initialWeights ?? {}) };
  let loss = 0;

  for (let epoch = 0; epoch < EPOCHS; epoch += 1) {
    loss = 0;
    for (const example of examples) {
      const prediction = sigmoid(dot(example.features, weights));
      const error = prediction - example.label;
      loss += -example.label * Math.log(Math.max(prediction, 1e-6)) - (1 - example.label) * Math.log(Math.max(1 - prediction, 1e-6));

      for (const feature of FEATURE_NAMES) {
        const regularization = feature === "bias" ? 0 : L2 * weights[feature];
        weights[feature] -= LEARNING_RATE * (error * (example.features[feature] ?? 0) + regularization);
      }
    }
  }

  const positiveCount = examples.filter((example) => example.label >= 0.7).length;
  const seedPositiveCount = examples.filter((example) => example.source === "spacenews_seed").length;
  const editorialExampleCount = examples.filter((example) => example.source === "editorial").length;

  return {
    id: randomId("model-run"),
    trained_at: now.toISOString(),
    model_name: MODEL_NAME,
    weights,
    example_count: examples.length,
    positive_count: positiveCount,
    seed_positive_count: seedPositiveCount,
    editorial_example_count: editorialExampleCount,
    loss: Number((examples.length ? loss / examples.length : 0).toFixed(6)),
    notes: "Low-cost logistic scorer trained in Cloudflare Worker/D1 from editorial decisions and SpaceNews seed positives.",
  };
}

export function trainingExamplesFromClusters(clusters) {
  const examples = [];

  for (const cluster of clusters) {
    const features = modelFeatures(cluster);
    const status = cluster.status;
    if (status === "approved") {
      examples.push({ features, label: 1, source: "editorial" });
    } else if (status === "watch") {
      examples.push({ features, label: 0.65, source: "editorial" });
    } else if (status === "rejected") {
      examples.push({ features, label: 0, source: "editorial" });
    }

    if (cluster.has_spacenews) {
      examples.push({ features, label: 1, source: "spacenews_seed" });
    } else if ((cluster.importance_score ?? 0) < 0.35) {
      examples.push({ features, label: 0.2, source: "low_score_seed" });
    }
  }

  return examples;
}

export function modelFeatures(cluster) {
  const text = `${cluster.representative_title ?? ""} ${cluster.summary ?? ""}`.toLowerCase();
  const reasons = Array.isArray(cluster.score_reasons)
    ? cluster.score_reasons
    : parseJsonArray(cluster.score_reasons_json);
  const reasonText = reasons.join(" ").toLowerCase();
  const sourceText = `${cluster.source_titles ?? ""} ${cluster.source_title_list ?? ""}`.toLowerCase();

  const features = {
    bias: 1,
    deterministic_score: Number(cluster.importance_score ?? 0),
    source_count: bounded(cluster.source_count, 5),
    region_count: bounded(cluster.region_count, 4),
    language_count: bounded(cluster.language_count, 3),
    has_spacenews: cluster.has_spacenews || sourceText.includes("spacenews") || text.includes("spacenews") ? 1 : 0,
    has_official_source: reasonText.includes("official") ? 1 : 0,
    has_non_western_source: reasonText.includes("non-western") || NON_WESTERN_REGIONS.has(cluster.primary_region) ? 1 : 0,
    is_recent: reasonText.includes("last 24 hours") ? 1 : 0,
  };

  for (const [feature, terms] of Object.entries(TOPIC_TERMS)) {
    features[feature] = terms.some((term) => text.includes(term)) ? 1 : 0;
  }

  return features;
}

function bounded(value, max) {
  return Math.min(Number(value ?? 0), max) / max;
}

function dot(features, weights) {
  return FEATURE_NAMES.reduce((sum, feature) => sum + (features[feature] ?? 0) * (weights[feature] ?? 0), 0);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function randomId(prefix) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
