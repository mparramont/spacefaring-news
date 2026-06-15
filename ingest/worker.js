import { D1NewsStore } from "./d1-store.js";
import { ingestFeeds } from "./ingest.js";
import { MODEL_NAME, defaultWeights, featureNames, trainEditorialModel, trainingExamplesFromClusters } from "./model.js";
import { rankDailyStories } from "./ranking.js";
import { ingestXPosts } from "./x.js";

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledIngestion(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsPreflight();
    }

    const store = new D1NewsStore(env.NEWS_DB);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/stats") {
      return json(await store.stats());
    }

    if (request.method === "GET" && url.pathname === "/admin/editorial") {
      return html(await renderEditorialAdmin(store, { refresh: url.searchParams.get("refresh") === "1" }));
    }

    if (request.method === "POST" && url.pathname === "/admin/model/train") {
      await runModelTraining(store, new Date());
      await runDailyRanking(store, new Date());
      return html(await renderEditorialAdmin(store, { notice: "Model training completed." }));
    }

    if (request.method === "POST" && url.pathname === "/admin/rankings/run") {
      await runDailyRanking(store, new Date());
      return html(await renderEditorialAdmin(store, { notice: "Ranking run completed." }));
    }

    if (request.method === "POST" && url.pathname === "/admin/story-decision") {
      await updateStoryDecision(request, store);
      return html(await renderEditorialAdmin(store, { notice: "Decision saved." }));
    }

    if (request.method === "GET" && url.pathname === "/sources") {
      return json(await store.sourcesWithLatest());
    }

    if (request.method === "GET" && url.pathname === "/sources-fragment") {
      const sources = await store.sourcesWithLatest();
      const fragment = renderSourcesFragment(sources, url.searchParams.get("q") ?? "");
      if (request.headers.get("HX-Request") === "true") {
        return html(fragment);
      }
      return html(renderSourcesDocument(fragment));
    }

    if (request.method === "GET" && url.pathname === "/items") {
      const limit = parseLimit(url.searchParams.get("limit"));
      const items = await store.recentItems(limit);
      return json(items);
    }

    return json({ ok: false, error: "not found" }, 404);
  },
};

async function runScheduledIngestion(env) {
  const store = new D1NewsStore(env.NEWS_DB);
  const now = new Date();
  await ingestFeeds(store, { now });
  await runModelTraining(store, now);

  if (!env.X_BEARER_TOKEN) {
    await runDailyRanking(store, now);
    return;
  }

  const startedAt = now.toISOString();
  const shouldPollX = await store.startDailyPoll("x-daily", startedAt);

  if (!shouldPollX) {
    return;
  }

  try {
    await ingestXPosts(store, {
      bearerToken: env.X_BEARER_TOKEN,
      now,
    });
  } catch (error) {
    console.error("X ingestion failed", error);
  } finally {
    await store.finishDailyPoll("x-daily", new Date().toISOString());
  }

  await runDailyRanking(store, now);
}

function parseLimit(value) {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 100)) : 50;
}

async function runDailyRanking(store, now) {
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const items = await store.recentItemsForRanking(since, 120);
  const modelWeights = await activeModelWeights(store);
  const ranking = rankDailyStories(items, {
    now,
    runDate: now.toISOString().slice(0, 10),
    maxClusters: 30,
    modelWeights,
  });
  await store.saveRankingRun(ranking);
  return ranking;
}

async function activeModelWeights(store) {
  const weights = await store.latestModelWeights(MODEL_NAME);
  return Object.keys(weights).length ? { ...defaultWeights(), ...weights } : null;
}

async function runModelTraining(store, now) {
  const clusters = await store.modelTrainingClusters(500);
  const examples = trainingExamplesFromClusters(clusters);
  const initialWeights = await store.latestModelWeights(MODEL_NAME);
  const run = trainEditorialModel(examples, {
    now,
    initialWeights: Object.keys(initialWeights).length ? initialWeights : defaultWeights(),
  });
  await store.saveModelRun(run);
  return run;
}

async function renderEditorialAdmin(store, options = {}) {
  let latest = options.refresh ? await runDailyRanking(store, new Date()) : await latestOrGeneratedRanking(store);
  let clusters = latest ? await store.storyClusters(latest.run_date, 50) : [];
  const modelRun = await store.latestModelRun(MODEL_NAME);
  const weights = await store.latestModelWeights(MODEL_NAME);

  if (!options.refresh && latest && clusters.length === 0) {
    latest = await runDailyRanking(store, new Date());
    clusters = await store.storyClusters(latest.run_date, 50);
  }

  return renderEditorialDocument({ latest, clusters, modelRun, weights, notice: options.notice });
}

async function latestOrGeneratedRanking(store) {
  const latest = await store.latestRankingRun();
  const now = new Date();
  if (latest?.run_date === now.toISOString().slice(0, 10)) return latest;
  return runDailyRanking(store, now);
}

async function updateStoryDecision(request, store) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const status = normalizeStatus(form.get("status"));
  const selectedPositionValue = String(form.get("selected_position") ?? "").trim();
  const selectedPosition = selectedPositionValue ? Number(selectedPositionValue) : null;
  const editorNote = String(form.get("editor_note") ?? "").trim() || null;

  if (!id) {
    throw new Error("Missing story cluster id");
  }

  await store.updateStoryClusterDecision(
    id,
    {
      status,
      selectedPosition: Number.isFinite(selectedPosition) ? Math.max(1, Math.trunc(selectedPosition)) : null,
      editorNote,
    },
    new Date().toISOString(),
  );
}

function normalizeStatus(value) {
  const status = String(value ?? "");
  return ["needs_review", "approved", "watch", "rejected"].includes(status) ? status : "needs_review";
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: corsHeaders("text/html;charset=UTF-8"),
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders(contentType) {
  const headers = {
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": [
      "Content-Type",
      "HX-Current-URL",
      "HX-Request",
      "HX-Target",
      "HX-Trigger",
      "HX-Trigger-Name",
    ].join(", "),
  };
  if (contentType) {
    headers["content-type"] = contentType;
  }
  return headers;
}

function renderSourcesFragment(sources, query) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? sources.filter((source) =>
        [
          source.id,
          source.title,
          source.region,
          source.language,
          source.category,
          source.latest_item_title ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : sources;

  return [
    `<section id="source-summary" class="source-summary" aria-live="polite">${filtered.length} of ${sources.length} active sources</section>`,
    `<section id="source-list" class="source-list" aria-live="polite">`,
    ...filtered.map(renderSourceCard),
    `</section>`,
  ].join("");
}

function renderEditorialDocument({ latest, clusters, modelRun, weights, notice }) {
  const runMeta = latest
    ? `${escapeHtml(latest.run_date)} / ${latest.cluster_count} clusters / ${latest.item_count} items / ${escapeHtml(latest.method)}`
    : "No ranking run stored.";
  const modelMeta = modelRun
    ? `${escapeHtml(modelRun.trained_at)} / ${modelRun.example_count} examples / ${modelRun.positive_count} positives / loss ${modelRun.loss}`
    : "No model run stored yet.";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Editorial Admin - Spacefaring News</title>
    <style>${ADMIN_DOCUMENT_CSS}</style>
  </head>
  <body>
    <div class="wrap admin-wrap">
      <header class="site">
        <p><a class="brand" href="https://spacefaring-news.pages.dev/">Spacefaring News</a></p>
      </header>
      <main>
        <p class="eyebrow">ADMIN</p>
        <h1>Editorial Queue</h1>
        ${notice ? `<p class="notice">${escapeHtml(notice)}</p>` : ""}
        <section class="admin-panel" aria-label="Ranking run">
          <p class="run-meta">${runMeta}</p>
          <form method="post" action="/admin/rankings/run">
            <button type="submit">Run ranking</button>
          </form>
        </section>
        <section class="admin-panel" aria-label="Learned scoring model">
          <div>
            <h2>Learned Scoring</h2>
            <p class="run-meta">${modelMeta}</p>
            <p class="run-meta">Model: ${escapeHtml(MODEL_NAME)} / weights: ${Object.keys(weights ?? {}).length || 0} / features: ${featureNames().length}</p>
          </div>
          <form method="post" action="/admin/model/train">
            <button type="submit">Train model</button>
          </form>
        </section>
        <section class="cluster-list" aria-label="Story clusters">
          ${clusters.length ? clusters.map(renderEditorialCluster).join("") : `<p class="empty">No story clusters stored.</p>`}
        </section>
      </main>
    </div>
  </body>
</html>`;
}

function renderEditorialCluster(cluster, index) {
  const reasons = cluster.score_reasons?.length
    ? `<ul class="reasons">${cluster.score_reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
    : "";
  return `<article class="cluster-card" data-status="${escapeAttr(cluster.status)}">
    <div class="cluster-head">
      <p class="rank">#${index + 1}</p>
      <h2><a href="${escapeAttr(cluster.representative_url)}" rel="noopener noreferrer">${escapeHtml(cluster.representative_title)}</a></h2>
      <p class="score">${Math.round(cluster.importance_score * 100)}%</p>
    </div>
    <p class="cluster-meta">${escapeHtml(cluster.status)} / ${cluster.source_count} source${cluster.source_count === 1 ? "" : "s"} / ${cluster.region_count} region${cluster.region_count === 1 ? "" : "s"} / ${cluster.language_count} language${cluster.language_count === 1 ? "" : "s"}${cluster.model_score == null ? "" : ` / model ${Math.round(cluster.model_score * 100)}%`}${cluster.has_spacenews ? " / SpaceNews seed" : ""}</p>
    ${cluster.summary ? `<p class="summary">${escapeHtml(cluster.summary)}</p>` : ""}
    ${reasons}
    <form method="post" action="/admin/story-decision" class="decision-form">
      <input type="hidden" name="id" value="${escapeAttr(cluster.id)}" />
      <label>
        Status
        <select name="status">
          ${renderStatusOption(cluster.status, "needs_review", "Needs review")}
          ${renderStatusOption(cluster.status, "approved", "Approved")}
          ${renderStatusOption(cluster.status, "watch", "Watch")}
          ${renderStatusOption(cluster.status, "rejected", "Rejected")}
        </select>
      </label>
      <label>
        Position
        <input name="selected_position" inputmode="numeric" value="${cluster.selected_position ?? ""}" />
      </label>
      <label class="note-label">
        Note
        <textarea name="editor_note" rows="2">${escapeHtml(cluster.editor_note ?? "")}</textarea>
      </label>
      <button type="submit">Save</button>
    </form>
  </article>`;
}

function renderStatusOption(current, value, label) {
  return `<option value="${value}"${current === value ? " selected" : ""}>${label}</option>`;
}

function renderSourcesDocument(fragment) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>Sources - Spacefaring News</title>
    <style>${SOURCE_DOCUMENT_CSS}</style>
  </head>
  <body>
    <div class="wrap sources-wrap">
      <header class="site">
        <p><a class="brand" href="https://spacefaring-news.pages.dev/">Spacefaring News</a></p>
      </header>
      <main>
        <p class="eyebrow">OPERATIONS</p>
        <h1>Sources</h1>
        <div id="sources-results">
          ${fragment}
        </div>
      </main>
    </div>
  </body>
</html>`;
}

const SOURCE_DOCUMENT_CSS = `
:root {
  color-scheme: light;
  --fg: #111;
  --muted: #555;
  --border: #d4d4d4;
  --bg: #fff;
  --card-bg: #fff;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --fg: #f0f0f0;
    --muted: #999;
    --border: #333;
    --bg: #0a0a0a;
    --card-bg: #111;
  }
}
* { box-sizing: border-box; }
body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  color: var(--fg);
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.65;
}
.wrap {
  max-width: 1040px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
header.site {
  border-bottom: 1px solid var(--border);
  margin-bottom: 2rem;
}
header.site p { margin: 0 0 0.25rem; }
header.site a.brand {
  color: var(--fg);
  font-size: 1.15rem;
  font-weight: 700;
  text-decoration: none;
}
.eyebrow {
  margin: 0 0 0.25rem;
  color: var(--muted);
  font-size: 0.9rem;
}
h1, h2, p { overflow-wrap: anywhere; }
h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
  line-height: 1.2;
}
.source-summary {
  margin: 1.5rem 0 1rem;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 600;
}
.source-list {
  display: grid;
  gap: 10px;
}
.source-card {
  display: grid;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding: 0.9rem 0;
}
.source-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: baseline;
}
.source-card h2 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.25;
}
.source-card a { color: var(--fg); }
.source-meta, .source-latest, .source-detail { margin: 0; }
.source-meta, .source-detail {
  color: var(--muted);
  font-size: 0.82rem;
}
.source-meta {
  text-transform: uppercase;
  white-space: nowrap;
}
.source-latest { font-size: 0.94rem; }
.source-detail {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
@media (max-width: 640px) {
  .wrap { padding: 1.25rem 1rem 3rem; }
  .source-card-header { grid-template-columns: 1fr; gap: 2px; }
  .source-meta { white-space: normal; }
}
`;

const ADMIN_DOCUMENT_CSS = `
:root {
  color-scheme: light;
  --fg: #111;
  --muted: #555;
  --border: #d4d4d4;
  --border-strong: #b8b8b8;
  --bg: #fff;
  --card-bg: #fff;
  --card-tint: #fafafa;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --fg: #f0f0f0;
    --muted: #999;
    --border: #333;
    --border-strong: #555;
    --bg: #0a0a0a;
    --card-bg: #111;
    --card-tint: #151515;
  }
}
* { box-sizing: border-box; }
body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  color: var(--fg);
  background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.55;
}
.wrap {
  max-width: 1120px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}
header.site {
  border-bottom: 1px solid var(--border);
  margin-bottom: 2rem;
}
header.site p { margin: 0 0 0.25rem; }
header.site a.brand {
  color: var(--fg);
  font-size: 1.15rem;
  font-weight: 700;
  text-decoration: none;
}
.eyebrow {
  margin: 0 0 0.25rem;
  color: var(--muted);
  font-size: 0.9rem;
}
h1 {
  margin: 0 0 1rem;
  font-size: 2rem;
  line-height: 1.2;
}
h2, p, li, label, input, textarea, select, button {
  overflow-wrap: anywhere;
}
.notice {
  border: 1px solid var(--border);
  background: var(--card-tint);
  padding: 0.7rem 0.85rem;
}
.admin-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
  margin: 1rem 0;
}
.run-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
button, select, input, textarea {
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
  color: var(--fg);
  background: var(--card-bg);
  font: inherit;
}
button {
  font-weight: 700;
  cursor: pointer;
}
button:hover, button:focus-visible {
  border-color: var(--fg);
}
.cluster-list {
  display: grid;
  gap: 1rem;
}
.cluster-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--card-bg);
}
.cluster-card[data-status="approved"] { border-color: var(--fg); }
.cluster-card[data-status="rejected"] { opacity: 0.72; }
.cluster-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: baseline;
}
.cluster-head h2 {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.25;
}
.cluster-head a {
  color: var(--fg);
}
.rank, .score {
  margin: 0;
  color: var(--muted);
  font-weight: 700;
}
.cluster-meta, .summary {
  margin: 0.5rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}
.reasons {
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;
  color: var(--muted);
  font-size: 0.88rem;
}
.decision-form {
  display: grid;
  grid-template-columns: minmax(9rem, 0.8fr) minmax(6rem, 0.4fr) minmax(0, 1.3fr) auto;
  gap: 0.75rem;
  align-items: end;
  margin-top: 1rem;
}
.decision-form label {
  display: grid;
  gap: 0.25rem;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  min-width: 0;
}
.decision-form input,
.decision-form select,
.decision-form textarea {
  width: 100%;
  min-width: 0;
}
.decision-form textarea {
  resize: vertical;
}
.empty {
  color: var(--muted);
}
@media (max-width: 980px) {
  .decision-form {
    grid-template-columns: minmax(10rem, 1fr) minmax(6rem, 0.5fr) minmax(14rem, 1fr);
  }
  .decision-form button {
    grid-column: 1 / -1;
    justify-self: end;
  }
}
@media (max-width: 760px) {
  .cluster-head, .decision-form {
    grid-template-columns: 1fr;
  }
  .decision-form button {
    justify-self: stretch;
  }
}
`;

function renderSourceCard(source) {
  const latestDate = (source.latest_item_published_at ?? source.latest_item_fetched_at ?? "").slice(0, 10);
  const latest =
    source.latest_item_title && source.latest_item_url
      ? `Latest: <a href="${escapeAttr(source.latest_item_url)}" rel="noopener noreferrer">${escapeHtml(source.latest_item_title)}</a>${latestDate ? ` (${escapeHtml(latestDate)})` : ""}`
      : "Latest: none stored yet";

  return `<article class="source-card"><div class="source-card-header"><h2><a href="${escapeAttr(source.homepage)}" rel="noopener noreferrer">${escapeHtml(source.title)}</a></h2><p class="source-meta">${escapeHtml(source.region)} / ${escapeHtml(source.language)} / ${escapeHtml(source.category)}</p></div><p class="source-latest">${latest}</p><p class="source-detail">${escapeHtml(source.url)}</p></article>`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function escapeAttr(value) {
  return escapeHtml(value);
}
