import { scoreClusterWithModel } from "./model.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "its",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const HIGH_IMPACT_TERMS = [
  "accident",
  "agreement",
  "artemis",
  "astronaut",
  "contract",
  "crew",
  "defense",
  "funding",
  "ipo",
  "launch",
  "mission",
  "moon",
  "policy",
  "regulation",
  "rocket",
  "satellite",
  "space station",
  "spacecraft",
];

const OFFICIAL_SOURCE_TERMS = ["agency", "cnes", "esa", "isro", "jaxa", "nasa", "space force"];
const NON_WESTERN_REGIONS = new Set(["africa", "brazil", "china", "india", "israel", "japan", "latam", "mena", "russia"]);

export function rankDailyStories(items, options = {}) {
  const now = options.now ?? new Date();
  const runDate = options.runDate ?? now.toISOString().slice(0, 10);
  const maxClusters = options.maxClusters ?? 50;
  const modelWeights = options.modelWeights ?? null;
  const startedAt = now.toISOString();
  const clustersByKey = new Map();

  for (const item of items) {
    const key = clusterKey(item);
    const cluster = clustersByKey.get(key) ?? {
      key,
      items: [],
      sourceIds: new Set(),
      regions: new Set(),
      languages: new Set(),
    };
    cluster.items.push(item);
    cluster.sourceIds.add(item.source_id ?? item.sourceId ?? item.source_title ?? item.sourceTitle);
    if (item.region) cluster.regions.add(item.region);
    if (item.language) cluster.languages.add(item.language);
    clustersByKey.set(key, cluster);
  }

  const clusters = [...clustersByKey.values()]
    .map((cluster) => scoreCluster(cluster, runDate, startedAt, modelWeights))
    .sort((left, right) => right.importance_score - left.importance_score || left.representative_title.localeCompare(right.representative_title))
    .slice(0, maxClusters);

  return {
    id: randomId("ranking-run"),
    run_date: runDate,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    item_count: items.length,
    cluster_count: clusters.length,
    method: modelWeights ? "deterministic-v1+editorial-logistic-v1" : "deterministic-v1",
    notes: modelWeights
      ? "No external model key required. Ranking blends deterministic signals with a low-cost D1-trained logistic editorial scorer."
      : "No external model key required. Ranking uses source diversity, region/language diversity, recency, topic terms, and official-source signals.",
    clusters,
  };
}

function scoreCluster(cluster, runDate, now, modelWeights) {
  const sortedItems = [...cluster.items].sort((left, right) => itemTime(right) - itemTime(left));
  const representative = sortedItems[0];
  const reasons = [];
  let score = 0.15;

  const sourceCount = cluster.sourceIds.size;
  const regionCount = cluster.regions.size;
  const languageCount = cluster.languages.size;

  const sourceScore = Math.min(sourceCount, 5) * 0.08;
  score += sourceScore;
  reasons.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);

  if (regionCount > 1) {
    score += Math.min(regionCount, 4) * 0.06;
    reasons.push(`${regionCount} regions`);
  }

  if (languageCount > 1) {
    score += Math.min(languageCount, 3) * 0.04;
    reasons.push(`${languageCount} languages`);
  }

  const titleText = cluster.items.map((item) => `${item.title} ${item.summary ?? ""}`).join(" ").toLowerCase();
  const matchedTerms = HIGH_IMPACT_TERMS.filter((term) => titleText.includes(term));
  if (matchedTerms.length > 0) {
    score += Math.min(matchedTerms.length, 4) * 0.07;
    reasons.push(`impact terms: ${matchedTerms.slice(0, 4).join(", ")}`);
  }

  const sourceText = cluster.items.map((item) => `${item.source_title ?? item.sourceTitle ?? ""} ${item.category ?? ""}`).join(" ").toLowerCase();
  if (OFFICIAL_SOURCE_TERMS.some((term) => sourceText.includes(term))) {
    score += 0.08;
    reasons.push("official or primary source signal");
  }

  if ([...cluster.regions].some((region) => NON_WESTERN_REGIONS.has(region))) {
    score += 0.04;
    reasons.push("non-western source signal");
  }

  const newestAgeHours = Math.max(0, (new Date(now).getTime() - itemTime(representative)) / 3_600_000);
  if (newestAgeHours <= 24) {
    score += 0.12;
    reasons.push("published in the last 24 hours");
  } else if (newestAgeHours <= 72) {
    score += 0.06;
    reasons.push("published in the last 72 hours");
  }

  const importanceScore = Math.min(0.99, Number(score.toFixed(3)));
  const sourceTitles = [...new Set(sortedItems.map((item) => item.source_title ?? item.sourceTitle).filter(Boolean))];
  const hasSpacenews = sortedItems.some((item) => {
    const text = `${item.source_id ?? item.sourceId ?? ""} ${item.source_title ?? item.sourceTitle ?? ""} ${item.url ?? ""}`.toLowerCase();
    return text.includes("spacenews.com") || text.includes("spacenews");
  });
  const preliminary = {
    representative_title: representative.title,
    summary: representative.summary ?? null,
    source_count: sourceCount,
    region_count: regionCount,
    language_count: languageCount,
    importance_score: importanceScore,
    score_reasons: reasons,
    has_spacenews: hasSpacenews,
    source_titles: sourceTitles.join(", "),
    primary_region: [...cluster.regions][0] ?? null,
  };
  const modelScore = modelWeights ? scoreClusterWithModel(preliminary, modelWeights) : null;
  const finalScore = modelScore == null ? importanceScore : Math.min(0.99, Number((importanceScore * 0.72 + modelScore * 0.28).toFixed(3)));

  return {
    id: `${runDate}-${cluster.key}`,
    run_date: runDate,
    cluster_key: cluster.key,
    representative_title: representative.title,
    representative_url: representative.url,
    summary: representative.summary ?? null,
    source_count: sourceCount,
    region_count: regionCount,
    language_count: languageCount,
    importance_score: finalScore,
    deterministic_score: importanceScore,
    model_score: modelScore == null ? null : Number(modelScore.toFixed(3)),
    score_reasons: modelScore == null ? reasons : [...reasons, `learned editorial score: ${Math.round(modelScore * 100)}%`],
    has_spacenews: hasSpacenews,
    source_titles: sourceTitles.join(", "),
    primary_region: [...cluster.regions][0] ?? null,
    item_ids: sortedItems.map((item) => item.id),
  };
}

function clusterKey(item) {
  const titleKey = normalizeTitle(item.title);
  if (titleKey) return titleKey;
  try {
    const url = new URL(item.url);
    return normalizeTitle(url.pathname) || url.hostname.replace(/^www\./, "") || stableHash(item.url);
  } catch {
    return normalizeTitle(item.url) || stableHash(`${item.title} ${item.url}`);
  }
}

function normalizeTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[#a-z0-9]+;/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .slice(0, 10)
    .join("-");
}

function itemTime(item) {
  const value = item.published_at ?? item.publishedAt ?? item.fetched_at ?? item.fetchedAt;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function randomId(prefix) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stableHash(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return `story-${hash.toString(16)}`;
}
