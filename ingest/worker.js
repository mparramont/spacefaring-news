import { D1NewsStore } from "./d1-store.js";
import { ingestFeeds } from "./ingest.js";
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

  if (!env.X_BEARER_TOKEN) {
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
}

function parseLimit(value) {
  const parsed = Number(value ?? 50);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 100)) : 50;
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
